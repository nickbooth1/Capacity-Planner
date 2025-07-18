import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getSession } from '../../../../lib/auth';
import { createAuditLog } from '../../../../lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json({ error: 'Failed to get organizations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, code, selectedModules } = await request.json();

    // Validate input
    if (!name || !code || !selectedModules || selectedModules.length === 0) {
      return NextResponse.json(
        { error: 'Name, code, and at least one module are required' },
        { status: 400 }
      );
    }

    // Validate IATA code format
    if (!/^[A-Z]{3}$/.test(code)) {
      return NextResponse.json(
        { error: 'Code must be a 3-letter uppercase code' },
        { status: 400 }
      );
    }

    // Check if organization already exists
    const existing = await prisma.organization.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this code already exists' },
        { status: 409 }
      );
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        code,
        createdBy: session.user.email,
        updatedBy: session.user.email,
      },
    });

    // Create entitlements
    const entitlementPromises = selectedModules.map(
      (moduleKey: string) =>
        prisma.$executeRaw`
        INSERT INTO entitlement.entitlements (
          id, organization_id, module_key, status, updated_by, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organization.id},
          ${moduleKey},
          'active',
          ${session.user.email},
          NOW()
        )
      `
    );

    await Promise.all(entitlementPromises);

    // Create audit log for organization creation
    await createAuditLog({
      entityType: 'organization',
      entityId: organization.id,
      action: 'created',
      changes: { name, code, modules: selectedModules },
      performedBy: session.user.email,
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Create audit logs for each entitlement
    for (const moduleKey of selectedModules) {
      await createAuditLog({
        entityType: 'entitlement',
        entityId: `${organization.id}-${moduleKey}`,
        action: 'created',
        changes: { organizationId: organization.id, moduleKey, status: 'active' },
        performedBy: session.user.email,
        organizationId: organization.id,
      });
    }

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
