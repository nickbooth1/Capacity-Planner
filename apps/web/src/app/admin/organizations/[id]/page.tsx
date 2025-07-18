import { prisma } from '../../../../lib/prisma';
import { notFound } from 'next/navigation';
import EditOrganizationForm from './EditOrganizationForm';

async function getOrganization(id: string) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      notFound();
    }

    return organization;
  } catch (error) {
    console.error('Error fetching organization:', error);
    notFound();
  }
}

export default async function EditOrganizationPage({ params }: { params: { id: string } }) {
  const organization = await getOrganization(params.id);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Edit Organization</h1>
      <EditOrganizationForm organization={organization} />
    </div>
  );
}
