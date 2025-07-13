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
  grantAccess(orgId: string, moduleKey: ModuleKey, validUntil?: Date): Promise<void>;
  revokeAccess(orgId: string, moduleKey: ModuleKey): Promise<void>;
  listEntitlements(orgId: string): Promise<Entitlement[]>;
}

// Mock implementation for now
export class MockEntitlementService implements EntitlementService {
  private entitlements: Map<string, Entitlement[]> = new Map();

  async hasAccess(orgId: string, moduleKey: ModuleKey): Promise<boolean> {
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const entitlement = orgEntitlements.find(e => e.moduleKey === moduleKey);
    
    if (!entitlement) return false;
    if (entitlement.status !== 'active') return false;
    if (entitlement.validUntil && new Date() > entitlement.validUntil) return false;
    
    return true;
  }

  async grantAccess(orgId: string, moduleKey: ModuleKey, validUntil?: Date): Promise<void> {
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const existingIndex = orgEntitlements.findIndex(e => e.moduleKey === moduleKey);
    
    const entitlement: Entitlement = {
      organizationId: orgId,
      moduleKey,
      status: 'active',
      validUntil,
      updatedBy: 'system',
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      orgEntitlements[existingIndex] = entitlement;
    } else {
      orgEntitlements.push(entitlement);
    }
    
    this.entitlements.set(orgId, orgEntitlements);
  }

  async revokeAccess(orgId: string, moduleKey: ModuleKey): Promise<void> {
    const orgEntitlements = this.entitlements.get(orgId) || [];
    const entitlement = orgEntitlements.find(e => e.moduleKey === moduleKey);
    
    if (entitlement) {
      entitlement.status = 'suspended';
      entitlement.updatedAt = new Date();
    }
  }

  async listEntitlements(orgId: string): Promise<Entitlement[]> {
    return this.entitlements.get(orgId) || [];
  }
}