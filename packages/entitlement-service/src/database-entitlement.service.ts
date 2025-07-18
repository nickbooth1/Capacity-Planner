import { PrismaClient } from './prisma';
import { ModuleKey } from '@capacity-planner/shared-kernel';
import { EntitlementService, Entitlement } from './index';

export class DatabaseEntitlementService implements EntitlementService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async hasAccess(orgId: string, moduleKey: ModuleKey): Promise<boolean> {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId: orgId,
          moduleKey: moduleKey,
        },
      },
    });

    if (!entitlement) return false;
    if (entitlement.status !== 'active') return false;
    if (entitlement.validUntil && new Date() > entitlement.validUntil) return false;

    return true;
  }

  async grantAccess(
    orgId: string,
    moduleKey: ModuleKey,
    validUntil?: Date,
    userId?: string
  ): Promise<void> {
    const existingEntitlement: any = await this.prisma.entitlement.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId: orgId,
          moduleKey: moduleKey,
        },
      },
    });

    const entitlementData = {
      organizationId: orgId,
      moduleKey: moduleKey,
      status: 'active',
      validUntil: validUntil,
      updatedBy: userId || 'system',
    };

    if (existingEntitlement) {
      // Update existing entitlement
      const previousValue = {
        status: existingEntitlement.status,
        validUntil: existingEntitlement.validUntil,
      };

      await this.prisma.$transaction([
        // Update the entitlement
        this.prisma.entitlement.update({
          where: { id: existingEntitlement.id },
          data: entitlementData,
        }),
        // Create audit log
        this.prisma.entitlementAudit.create({
          data: {
            entitlementId: existingEntitlement.id,
            organizationId: orgId,
            moduleKey: moduleKey,
            action: existingEntitlement.status === 'active' ? 'updated' : 'reactivated',
            previousValue: previousValue,
            newValue: {
              status: 'active',
              validUntil: validUntil,
            },
            performedBy: userId || 'system',
            reason:
              existingEntitlement.status === 'active'
                ? 'Access period updated'
                : 'Access reactivated',
          },
        }),
      ]);
    } else {
      // Create new entitlement
      await this.prisma.$transaction(async (tx: any) => {
        const newEntitlement = await tx.entitlement.create({
          data: {
            ...entitlementData,
            createdBy: userId || 'system',
          },
        });

        await tx.entitlementAudit.create({
          data: {
            entitlementId: newEntitlement.id,
            organizationId: orgId,
            moduleKey: moduleKey,
            action: 'created',
            newValue: {
              status: 'active',
              validUntil: validUntil,
            },
            performedBy: userId || 'system',
            reason: 'Initial access granted',
          },
        });
      });
    }
  }

  async revokeAccess(orgId: string, moduleKey: ModuleKey, userId?: string): Promise<void> {
    const entitlement: any = await this.prisma.entitlement.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId: orgId,
          moduleKey: moduleKey,
        },
      },
    });

    if (!entitlement) {
      throw new Error(`No entitlement found for organization ${orgId} and module ${moduleKey}`);
    }

    const previousValue = {
      status: entitlement.status,
      validUntil: entitlement.validUntil,
    };

    await this.prisma.$transaction([
      // Update entitlement status
      this.prisma.entitlement.update({
        where: { id: entitlement.id },
        data: {
          status: 'suspended',
          updatedBy: userId || 'system',
        },
      }),
      // Create audit log
      this.prisma.entitlementAudit.create({
        data: {
          entitlementId: entitlement.id,
          organizationId: orgId,
          moduleKey: moduleKey,
          action: 'suspended',
          previousValue: previousValue,
          newValue: {
            status: 'suspended',
            validUntil: entitlement.validUntil,
          },
          performedBy: userId || 'system',
          reason: 'Access revoked',
        },
      }),
    ]);
  }

  async listEntitlements(orgId: string): Promise<Entitlement[]> {
    const dbEntitlements = await this.prisma.entitlement.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: {
        moduleKey: 'asc',
      },
    });

    return dbEntitlements.map((e: any) => ({
      organizationId: e.organizationId,
      moduleKey: e.moduleKey as ModuleKey,
      status: e.status as 'active' | 'suspended',
      validUntil: e.validUntil || undefined,
      updatedBy: e.updatedBy || 'system',
      updatedAt: e.updatedAt,
    }));
  }

  // Additional methods for full CRUD operations
  async getEntitlement(orgId: string, moduleKey: ModuleKey): Promise<Entitlement | null> {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId: orgId,
          moduleKey: moduleKey,
        },
      },
    });

    if (!entitlement) return null;

    return {
      organizationId: entitlement.organizationId,
      moduleKey: entitlement.moduleKey as ModuleKey,
      status: entitlement.status as 'active' | 'suspended',
      validUntil: entitlement.validUntil || undefined,
      updatedBy: entitlement.updatedBy || 'system',
      updatedAt: entitlement.updatedAt,
    };
  }

  async getAllEntitlements(): Promise<Entitlement[]> {
    const dbEntitlements = await this.prisma.entitlement.findMany({
      orderBy: [{ organizationId: 'asc' }, { moduleKey: 'asc' }],
    });

    return dbEntitlements.map((e: any) => ({
      organizationId: e.organizationId,
      moduleKey: e.moduleKey as ModuleKey,
      status: e.status as 'active' | 'suspended',
      validUntil: e.validUntil || undefined,
      updatedBy: e.updatedBy || 'system',
      updatedAt: e.updatedAt,
    }));
  }

  async getAuditHistory(orgId: string, moduleKey?: ModuleKey, limit: number = 50): Promise<any[]> {
    const where: any = {
      organizationId: orgId,
    };

    if (moduleKey) {
      where.moduleKey = moduleKey;
    }

    return await this.prisma.entitlementAudit.findMany({
      where,
      orderBy: {
        performedAt: 'desc',
      },
      take: limit,
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
