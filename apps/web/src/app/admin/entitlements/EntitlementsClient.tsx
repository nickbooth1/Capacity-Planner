'use client';

import { useState } from 'react';
import styles from './entitlements.module.css';
import { getAvailableModules } from '../../../lib/modules';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Entitlement {
  id: string;
  organization_id: string;
  module_key: string;
  status: string;
  valid_until: Date | null;
  updated_by: string;
  updated_at: Date;
}

interface Props {
  organizations: Organization[];
  initialEntitlements: Entitlement[];
}

const MODULES = getAvailableModules();

export default function EntitlementsClient({ organizations, initialEntitlements }: Props) {
  const [entitlements, setEntitlements] = useState(initialEntitlements);
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  const getEntitlementStatus = (orgId: string, moduleKey: string) => {
    const entitlement = entitlements.find(
      (e) => e.organization_id === orgId && e.module_key === moduleKey
    );
    return entitlement?.status === 'active';
  };

  const toggleEntitlement = async (orgId: string, moduleKey: string) => {
    const key = `${orgId}-${moduleKey}`;
    setLoading(key);

    try {
      const isActive = getEntitlementStatus(orgId, moduleKey);
      const response = await fetch('/api/admin/entitlements', {
        method: isActive ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, moduleKey }),
      });

      if (response.ok) {
        // Refresh entitlements
        const refreshResponse = await fetch('/api/admin/entitlements');
        const data = await refreshResponse.json();
        setEntitlements(data.entitlements);
      }
    } catch (error) {
      console.error('Failed to toggle entitlement:', error);
    } finally {
      setLoading(null);
    }
  };

  const filteredOrganizations = selectedOrg
    ? organizations.filter((org) => org.id === selectedOrg)
    : organizations;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Entitlements Management</h1>

      <div className={styles.filterSection}>
        <label htmlFor="orgFilter">Filter by Organization:</label>
        <select
          id="orgFilter"
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className={styles.select}
        >
          <option value="">All Organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.code})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.entitlementsGrid}>
        {filteredOrganizations.map((org) => (
          <div key={org.id} className={styles.orgCard}>
            <div className={styles.orgHeader}>
              <h2>{org.name}</h2>
              <span className={styles.orgCode}>{org.code}</span>
            </div>

            <div className={styles.modulesList}>
              {MODULES.map((module) => {
                const isActive = getEntitlementStatus(org.id, module.key);
                const isLoading = loading === `${org.id}-${module.key}`;

                return (
                  <div key={module.key} className={styles.moduleRow}>
                    <span className={styles.moduleName}>{module.name}</span>
                    <button
                      onClick={() => toggleEntitlement(org.id, module.key)}
                      disabled={isLoading}
                      className={`${styles.toggleButton} ${isActive ? styles.active : ''}`}
                    >
                      {isLoading ? '...' : isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
