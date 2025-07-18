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

    const entitlements = await prisma.$queryRaw`
      SELECT * FROM entitlement.entitlements
      ORDER BY organization_id, module_key
    `;

    return NextResponse.json({ entitlements });
  } catch (error) {
    console.error('Get entitlements error:', error);
    return NextResponse.json({ error: 'Failed to get entitlements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, moduleKey } = await request.json();

    if (!organizationId || !moduleKey) {
      return NextResponse.json(
        { error: 'Organization ID and module key are required' },
        { status: 400 }
      );
    }

    // Check if entitlement already exists
    const existing = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM entitlement.entitlements
      WHERE organization_id = ${organizationId}
      AND module_key = ${moduleKey}
    `;

    if (Number(existing[0].count) > 0) {
      // Update existing to active
      await prisma.$executeRaw`
        UPDATE entitlement.entitlements
        SET status = 'active',
            updated_by = ${session.user.email},
            updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
        AND module_key = ${moduleKey}
      `;
    } else {
      // Create new
      await prisma.$executeRaw`
        INSERT INTO entitlement.entitlements (
          id, organization_id, module_key, status, updated_by, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          ${moduleKey},
          'active',
          ${session.user.email},
          NOW()
        )
      `;
    }

    // Create audit log
    await createAuditLog({
      entityType: 'entitlement',
      entityId: `${organizationId}-${moduleKey}`,
      action: Number(existing[0].count) > 0 ? 'updated' : 'created',
      changes: { organizationId, moduleKey, status: 'active' },
      performedBy: session.user.email,
      organizationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Create entitlement error:', error);
    return NextResponse.json({ error: 'Failed to create entitlement' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, moduleKey } = await request.json();

    if (!organizationId || !moduleKey) {
      return NextResponse.json(
        { error: 'Organization ID and module key are required' },
        { status: 400 }
      );
    }

    // Set to inactive instead of deleting
    await prisma.$executeRaw`
      UPDATE entitlement.entitlements
      SET status = 'inactive',
          updated_by = ${session.user.email},
          updated_at = NOW()
      WHERE organization_id = ${organizationId}
      AND module_key = ${moduleKey}
    `;

    // Create audit log
    await createAuditLog({
      entityType: 'entitlement',
      entityId: `${organizationId}-${moduleKey}`,
      action: 'updated',
      changes: { organizationId, moduleKey, status: 'inactive' },
      performedBy: session.user.email,
      organizationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete entitlement error:', error);
    return NextResponse.json({ error: 'Failed to delete entitlement' }, { status: 500 });
  }
}
