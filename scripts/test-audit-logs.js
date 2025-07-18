const { PrismaClient } = require('../node_modules/.prisma/shared-kernel');

const prisma = new PrismaClient();

async function createTestAuditLogs() {
  try {
    const logs = [
      {
        entityType: 'user',
        entityId: 'test-user-1',
        action: 'login',
        performedBy: 'admin@capacity-planner.com',
        ipAddress: '192.168.1.100',
      },
      {
        entityType: 'organization',
        entityId: 'test-org-1',
        action: 'created',
        changes: { name: 'Test Airport', code: 'TST' },
        performedBy: 'admin@capacity-planner.com',
      },
      {
        entityType: 'entitlement',
        entityId: 'test-org-1-assets',
        action: 'created',
        changes: { moduleKey: 'assets', status: 'active' },
        performedBy: 'admin@capacity-planner.com',
        organizationId: 'test-org-1',
      },
      {
        entityType: 'entitlement',
        entityId: 'test-org-1-work',
        action: 'updated',
        changes: { status: 'inactive' },
        performedBy: 'admin@capacity-planner.com',
        organizationId: 'test-org-1',
      },
    ];

    for (const log of logs) {
      await prisma.auditLog.create({
        data: log,
      });
    }

    console.log(`Created ${logs.length} test audit logs`);
  } catch (error) {
    console.error('Error creating test audit logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAuditLogs();