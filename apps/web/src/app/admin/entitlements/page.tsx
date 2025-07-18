import { prisma } from '../../../lib/prisma';
import EntitlementsClient from './EntitlementsClient';

async function getEntitlementsData() {
  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      orderBy: { name: 'asc' },
    });

    // Get all entitlements
    const entitlements = await prisma.$queryRaw<
      {
        id: string;
        organization_id: string;
        module_key: string;
        status: string;
        valid_until: Date | null;
        updated_by: string;
        updated_at: Date;
      }[]
    >`
      SELECT * FROM entitlement.entitlements
      ORDER BY organization_id, module_key
    `;

    return { organizations, entitlements };
  } catch (error) {
    console.error('Error fetching entitlements data:', error);
    return { organizations: [], entitlements: [] };
  }
}

export default async function EntitlementsPage() {
  const { organizations, entitlements } = await getEntitlementsData();

  return <EntitlementsClient organizations={organizations} initialEntitlements={entitlements} />;
}
