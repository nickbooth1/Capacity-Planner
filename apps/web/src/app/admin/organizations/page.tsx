import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import styles from './organizations.module.css';

async function getOrganizations() {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get entitlement counts for each organization
    const orgsWithEntitlements = await Promise.all(
      organizations.map(async (org) => {
        const entitlements = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count 
          FROM entitlement.entitlements 
          WHERE organization_id = ${org.id}
          AND status = 'active'
          AND (valid_until IS NULL OR valid_until > NOW())
        `;

        return {
          ...org,
          activeEntitlements: Number(entitlements[0]?.count || 0),
        };
      })
    );

    return orgsWithEntitlements;
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Organizations</h1>
        <Link href="/admin/organizations/new" className={styles.createButton}>
          Create Organization
        </Link>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Active Modules</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id}>
                <td>{org.name}</td>
                <td>
                  <span className={styles.code}>{org.code}</span>
                </td>
                <td>{org.activeEntitlements}</td>
                <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/admin/organizations/${org.id}`} className={styles.actionLink}>
                      Edit
                    </Link>
                    <Link
                      href={`/admin/organizations/${org.id}/entitlements`}
                      className={styles.actionLink}
                    >
                      Manage Modules
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {organizations.length === 0 && (
          <div className={styles.emptyState}>
            <p>No organizations found. Create your first organization to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
