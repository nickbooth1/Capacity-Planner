import { prisma } from '../../../../../lib/prisma';
import { notFound } from 'next/navigation';
import ManageEntitlementsForm from './ManageEntitlementsForm';
import { getAvailableModules } from '../../../../../lib/modules';

async function getOrganizationWithEntitlements(id: string) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      notFound();
    }

    // Get current entitlements
    const entitlements = await prisma.$queryRaw<{ module_key: string; status: string }[]>`
      SELECT module_key, status
      FROM entitlement.entitlements
      WHERE organization_id = ${id}
      AND status = 'active'
    `;

    const activeModules = entitlements.map((e) => e.module_key);

    return { organization, activeModules };
  } catch (error) {
    console.error('Error fetching organization:', error);
    notFound();
  }
}

export default async function ManageEntitlementsPage({ params }: { params: { id: string } }) {
  const { organization, activeModules } = await getOrganizationWithEntitlements(params.id);
  const availableModules = getAvailableModules();

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Manage Modules</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Organization: <strong>{organization.name}</strong> ({organization.code})
      </p>
      <ManageEntitlementsForm
        organizationId={organization.id}
        organizationName={organization.name}
        availableModules={availableModules}
        activeModules={activeModules}
      />
    </div>
  );
}
