import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getSession } from '../../../../../lib/auth';
import { createAuditLog } from '../../../../../lib/audit';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json({ error: 'Failed to get organization' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, code } = await request.json();

    // Validate input
    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    // Validate IATA code format
    if (!/^[A-Z]{3}$/.test(code)) {
      return NextResponse.json(
        { error: 'Code must be a 3-letter uppercase code' },
        { status: 400 }
      );
    }

    // Check if code is already taken by another organization
    const existing = await prisma.organization.findFirst({
      where: {
        code,
        NOT: { id: params.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this code already exists' },
        { status: 409 }
      );
    }

    // Update organization
    const organization = await prisma.organization.update({
      where: { id: params.id },
      data: {
        name,
        code,
        updatedBy: session.user.email,
      },
    });

    // Create audit log
    await createAuditLog({
      entityType: 'organization',
      entityId: organization.id,
      action: 'updated',
      changes: { name, code },
      performedBy: session.user.email,
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if organization has any users
    const userCount = await prisma.user.count({
      where: { organizationId: params.id },
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with existing users' },
        { status: 400 }
      );
    }

    // Delete all entitlements for this organization
    await prisma.$executeRaw`
      DELETE FROM entitlement.entitlements
      WHERE organization_id = ${params.id}
    `;

    // Delete organization
    await prisma.organization.delete({
      where: { id: params.id },
    });

    // Create audit log
    await createAuditLog({
      entityType: 'organization',
      entityId: params.id,
      action: 'deleted',
      changes: { name: organization.name, code: organization.code },
      performedBy: session.user.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
