import { prisma } from '../../../lib/prisma';
import styles from './dashboard.module.css';

async function getDashboardData() {
  try {
    const [organizationCount, userCount, activeEntitlements] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count 
        FROM entitlement.entitlements 
        WHERE status = 'active' 
        AND (valid_until IS NULL OR valid_until > NOW())
      `,
    ]);

    // Get recent organizations
    const recentOrganizations = await prisma.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    return {
      organizationCount,
      userCount,
      activeEntitlements: Number(activeEntitlements[0]?.count || 0),
      recentOrganizations,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      organizationCount: 0,
      userCount: 0,
      activeEntitlements: 0,
      recentOrganizations: [],
    };
  }
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Total Organizations</h3>
          <p className={styles.statNumber}>{data.organizationCount}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Users</h3>
          <p className={styles.statNumber}>{data.userCount}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Active Entitlements</h3>
          <p className={styles.statNumber}>{data.activeEntitlements}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Recent Organizations</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrganizations.map((org) => (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  <td>{org.code}</td>
                  <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <a href="/admin/organizations/new" className={styles.actionButton}>
            Create Organization
          </a>
          <a href="/admin/entitlements" className={styles.actionButton}>
            Manage Entitlements
          </a>
        </div>
      </div>
    </div>
  );
}
