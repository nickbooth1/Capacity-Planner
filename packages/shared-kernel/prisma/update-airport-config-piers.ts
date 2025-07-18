import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';

const prisma = new PrismaClient();

async function updateAirportConfigurationWithPiers() {
  console.log('🛫 Updating Manchester Airport configuration with piers...');

  // Check if Manchester Airport organization exists
  const organization = await prisma.organization.findUnique({
    where: { code: 'MAN' },
  });

  if (!organization) {
    console.error('❌ Manchester Airport organization not found.');
    return;
  }

  // Update the configuration with piers
  const updatedConfig = await prisma.airportConfiguration.update({
    where: { organizationId: organization.id },
    data: {
      terminals: [
        {
          id: 't1',
          code: 'T1',
          name: 'Terminal 1',
          standRanges: ['1-8'],
          piers: [
            { code: 'A', name: 'Pier A', standRanges: ['1-4'] },
            { code: 'B', name: 'Pier B', standRanges: ['5-8'] },
          ],
        },
        {
          id: 't2',
          code: 'T2',
          name: 'Terminal 2',
          standRanges: ['20-27'],
          piers: [
            { code: 'C', name: 'Pier C', standRanges: ['20-23'] },
            { code: 'D', name: 'Pier D', standRanges: ['24-27'] },
          ],
        },
        {
          id: 't3',
          code: 'T3',
          name: 'Terminal 3',
          standRanges: ['40-47'],
          piers: [
            { code: 'E', name: 'Pier E', standRanges: ['40-43'] },
            { code: 'F', name: 'Pier F', standRanges: ['44-47'] },
          ],
        },
      ],
      version: { increment: 1 },
      updatedBy: 'system',
    },
  });

  console.log('✅ Updated airport configuration with piers:', {
    id: updatedConfig.id,
    organizationId: updatedConfig.organizationId,
    terminals: (updatedConfig.terminals as any[]).map((t) => ({
      code: t.code,
      name: t.name,
      piers: t.piers.length,
    })),
  });
}

async function main() {
  try {
    await updateAirportConfigurationWithPiers();
  } catch (error) {
    console.error('Error updating airport configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
