import { ModuleKey } from '@capacity-planner/shared-kernel';

export interface Entitlement {
  organizationId: string;
  moduleKey: ModuleKey;
  status: 'active' | 'suspended';
  validUntil?: Date;
  updatedBy: string;
  updatedAt: Date;
}

export interface EntitlementService {
  hasAccess(orgId: string, moduleKey: ModuleKey): Promise<boolean>;
  grantAccess(
    orgId: string,
    moduleKey: ModuleKey,
    validUntil?: Date,
    userId?: string
  ): Promise<void>;
  revokeAccess(orgId: string, moduleKey: ModuleKey, userId?: string): Promise<void>;
  listEntitlements(orgId: string): Promise<Entitlement[]>;
}

// Extended interface for full CRUD operations
export interface ExtendedEntitlementService extends EntitlementService {
  getEntitlement(orgId: string, moduleKey: ModuleKey): Promise<Entitlement | null>;
  getAllEntitlements(): Promise<Entitlement[]>;
  getAuditHistory(orgId: string, moduleKey?: ModuleKey, limit?: number): Promise<any[]>;
  disconnect(): Promise<void>;
}

// Export all implementations
export { DatabaseEntitlementService } from './database-entitlement.service';
export { CachedEntitlementService } from './cached-entitlement.service';

// Mock implementation for now
export class MockEntitlementService implements EntitlementService {
  private entitlements: Map<string, Entitlement[]> = new Map();

  async hasAccess(orgId: string, moduleKey: ModuleKey): Promise<boolean> {
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const entitlement = orgEntitlements.find((e) => e.moduleKey === moduleKey);

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
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const existingIndex = orgEntitlements.findIndex((e) => e.moduleKey === moduleKey);

    const entitlement: Entitlement = {
      organizationId: orgId,
      moduleKey,
      status: 'active',
      validUntil,
      updatedBy: userId || 'system',
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      orgEntitlements[existingIndex] = entitlement;
    } else {
      orgEntitlements.push(entitlement);
    }

    this.entitlements.set(orgId, orgEntitlements);
  }

  async revokeAccess(orgId: string, moduleKey: ModuleKey, userId?: string): Promise<void> {
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const entitlement = orgEntitlements.find((e) => e.moduleKey === moduleKey);

    if (entitlement) {
      entitlement.status = 'suspended';
      entitlement.updatedBy = userId || 'system';
      entitlement.updatedAt = new Date();
    }
  }

  async listEntitlements(orgId: string): Promise<Entitlement[]> {
    return this.entitlements.get(orgId) || [];
  }
}
