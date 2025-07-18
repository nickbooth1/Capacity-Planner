import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';

const prisma = new PrismaClient();

async function seedAirportConfiguration() {
  console.log('🛫 Seeding Manchester Airport configuration...');

  // Check if Manchester Airport organization exists
  const organization = await prisma.organization.findUnique({
    where: { code: 'MAN' },
  });

  if (!organization) {
    console.error('❌ Manchester Airport organization not found. Please ensure it exists first.');
    return;
  }

  // Check if configuration already exists
  const existingConfig = await prisma.airportConfiguration.findUnique({
    where: { organizationId: organization.id },
  });

  if (existingConfig) {
    console.log('✅ Airport configuration already exists for Manchester Airport');
    return;
  }

  // Manchester Airport configuration
  const manchesterConfig = {
    organizationId: organization.id,
    icaoCode: 'EGCC',
    iataCode: 'MAN',
    timezone: 'Europe/London',
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
    runways: [
      {
        id: 'rw1',
        code: '05L/23R',
        name: 'Runway 1',
        length: 3048,
        width: 46,
        surface: 'Asphalt',
      },
      {
        id: 'rw2',
        code: '05R/23L',
        name: 'Runway 2',
        length: 3200,
        width: 46,
        surface: 'Asphalt',
      },
    ],
    metadata: {
      remoteStandRanges: ['101-103'],
      totalStands: 28,
      elevation: 257,
      coordinates: {
        latitude: 53.3536,
        longitude: -2.275,
      },
    },
    createdBy: 'system',
    updatedBy: 'system',
  };

  // Create the airport configuration
  const airportConfig = await prisma.airportConfiguration.create({
    data: manchesterConfig,
  });

  console.log('✅ Created airport configuration:', {
    id: airportConfig.id,
    organizationId: airportConfig.organizationId,
    icaoCode: airportConfig.icaoCode,
    terminals: (airportConfig.terminals as any[]).length,
  });
}

async function main() {
  try {
    await seedAirportConfiguration();
  } catch (error) {
    console.error('Error seeding airport configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
