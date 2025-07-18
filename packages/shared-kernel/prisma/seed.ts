import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding shared-kernel database...');

  // Create Manchester Airport organization
  const manchesterAirport = await prisma.organization.upsert({
    where: { code: 'MAN' },
    update: {},
    create: {
      name: 'Manchester Airport',
      code: 'MAN',
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  console.log('✅ Created organization:', manchesterAirport.name);

  // Create airport configuration for Manchester Airport
  const airportConfig = await prisma.airportConfiguration.upsert({
    where: { organizationId: manchesterAirport.id },
    update: {},
    create: {
      organizationId: manchesterAirport.id,
      icaoCode: 'EGCC',
      iataCode: 'MAN',
      timezone: 'Europe/London',
      terminals: [
        {
          id: 't1',
          code: 'T1',
          name: 'Terminal 1',
          piers: [
            {
              id: 'p1',
              code: 'P1',
              name: 'Pier 1',
              stands: ['1', '2', '3', '4', '5', '6', '7', '8'],
            },
          ],
        },
        {
          id: 't2',
          code: 'T2',
          name: 'Terminal 2',
          piers: [
            {
              id: 'p2',
              code: 'P2',
              name: 'Pier 2',
              stands: ['20', '21', '22', '23', '24', '25', '26', '27'],
            },
          ],
        },
        {
          id: 't3',
          code: 'T3',
          name: 'Terminal 3',
          piers: [
            {
              id: 'p3',
              code: 'P3',
              name: 'Pier 3',
              stands: ['40', '41', '42', '43', '44', '45', '46', '47'],
            },
          ],
        },
      ],
      runways: [
        {
          id: 'rw1',
          designation: '05L/23R',
          length: 3048,
          width: 46,
          surface: 'Asphalt',
          active: true,
        },
        {
          id: 'rw2',
          designation: '05R/23L',
          length: 3200,
          width: 46,
          surface: 'Concrete',
          active: true,
        },
      ],
      metadata: {
        elevation: 257,
        elevationUnit: 'feet',
        magneticVariation: -2.0,
        transitionAltitude: 6000,
        transitionLevel: 70,
      },
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  console.log('✅ Created airport configuration for Manchester Airport');

  // Create some test users for Manchester Airport
  const users = [
    {
      email: 'admin@manchesterairport.com',
      name: 'John Smith',
      role: 'admin',
      organizationId: manchesterAirport.id,
    },
    {
      email: 'asset.owner@manchesterairport.com',
      name: 'Sarah Johnson',
      role: 'asset_owner',
      organizationId: manchesterAirport.id,
    },
    {
      email: 'requester@manchesterairport.com',
      name: 'Mike Wilson',
      role: 'requester',
      organizationId: manchesterAirport.id,
    },
    {
      email: 'viewer@manchesterairport.com',
      name: 'Emma Davis',
      role: 'viewer',
      organizationId: manchesterAirport.id,
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });
    console.log(`✅ Created user: ${user.name} (${user.role})`);
  }

  console.log('✅ Shared-kernel seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
