import { PrismaClient } from '../../../node_modules/.prisma/assets-module';
import { PrismaClient as SharedPrismaClient } from '../../../node_modules/.prisma/shared-kernel';

const prisma = new PrismaClient();
const sharedPrisma = new SharedPrismaClient();

// Manchester Airport stand data based on real terminal layout
const manchesterStands = [
  // Terminal 1 Stands
  { code: '1', name: 'Stand 1', terminal: 'T1', aircraftSize: 'C', lat: 53.3619, lng: -2.2729 },
  { code: '2', name: 'Stand 2', terminal: 'T1', aircraftSize: 'C', lat: 53.362, lng: -2.2728 },
  { code: '3', name: 'Stand 3', terminal: 'T1', aircraftSize: 'C', lat: 53.3621, lng: -2.2727 },
  { code: '4', name: 'Stand 4', terminal: 'T1', aircraftSize: 'C', lat: 53.3622, lng: -2.2726 },
  { code: '5', name: 'Stand 5', terminal: 'T1', aircraftSize: 'C', lat: 53.3623, lng: -2.2725 },
  { code: '6', name: 'Stand 6', terminal: 'T1', aircraftSize: 'D', lat: 53.3624, lng: -2.2724 },
  { code: '7', name: 'Stand 7', terminal: 'T1', aircraftSize: 'D', lat: 53.3625, lng: -2.2723 },
  { code: '8', name: 'Stand 8', terminal: 'T1', aircraftSize: 'D', lat: 53.3626, lng: -2.2722 },

  // Terminal 2 Stands
  { code: '20', name: 'Stand 20', terminal: 'T2', aircraftSize: 'C', lat: 53.363, lng: -2.27 },
  { code: '21', name: 'Stand 21', terminal: 'T2', aircraftSize: 'C', lat: 53.3631, lng: -2.2699 },
  { code: '22', name: 'Stand 22', terminal: 'T2', aircraftSize: 'C', lat: 53.3632, lng: -2.2698 },
  { code: '23', name: 'Stand 23', terminal: 'T2', aircraftSize: 'C', lat: 53.3633, lng: -2.2697 },
  { code: '24', name: 'Stand 24', terminal: 'T2', aircraftSize: 'D', lat: 53.3634, lng: -2.2696 },
  { code: '25', name: 'Stand 25', terminal: 'T2', aircraftSize: 'D', lat: 53.3635, lng: -2.2695 },
  { code: '26', name: 'Stand 26', terminal: 'T2', aircraftSize: 'E', lat: 53.3636, lng: -2.2694 },
  { code: '27', name: 'Stand 27', terminal: 'T2', aircraftSize: 'E', lat: 53.3637, lng: -2.2693 },

  // Terminal 3 Stands
  { code: '40', name: 'Stand 40', terminal: 'T3', aircraftSize: 'C', lat: 53.364, lng: -2.268 },
  { code: '41', name: 'Stand 41', terminal: 'T3', aircraftSize: 'C', lat: 53.3641, lng: -2.2679 },
  { code: '42', name: 'Stand 42', terminal: 'T3', aircraftSize: 'C', lat: 53.3642, lng: -2.2678 },
  { code: '43', name: 'Stand 43', terminal: 'T3', aircraftSize: 'D', lat: 53.3643, lng: -2.2677 },
  { code: '44', name: 'Stand 44', terminal: 'T3', aircraftSize: 'D', lat: 53.3644, lng: -2.2676 },
  { code: '45', name: 'Stand 45', terminal: 'T3', aircraftSize: 'E', lat: 53.3645, lng: -2.2675 },
  { code: '46', name: 'Stand 46', terminal: 'T3', aircraftSize: 'E', lat: 53.3646, lng: -2.2674 },
  { code: '47', name: 'Stand 47', terminal: 'T3', aircraftSize: 'F', lat: 53.3647, lng: -2.2673 },

  // Remote Stands
  {
    code: '101',
    name: 'Remote Stand 101',
    terminal: null,
    aircraftSize: 'C',
    lat: 53.365,
    lng: -2.275,
  },
  {
    code: '102',
    name: 'Remote Stand 102',
    terminal: null,
    aircraftSize: 'C',
    lat: 53.3651,
    lng: -2.2749,
  },
  {
    code: '103',
    name: 'Remote Stand 103',
    terminal: null,
    aircraftSize: 'D',
    lat: 53.3652,
    lng: -2.2748,
  },
  {
    code: '104',
    name: 'Remote Stand 104',
    terminal: null,
    aircraftSize: 'D',
    lat: 53.3653,
    lng: -2.2747,
  },
];

async function main() {
  console.log('🌱 Seeding assets-module database...');

  // Get Manchester Airport organization
  const manchesterOrg = await sharedPrisma.organization.findUnique({
    where: { code: 'MAN' },
  });

  if (!manchesterOrg) {
    throw new Error('Manchester Airport organization not found. Run shared-kernel seed first.');
  }

  // Create asset type for stands
  const standAssetType = await prisma.assetType.upsert({
    where: {
      organizationId_key: {
        organizationId: manchesterOrg.id,
        key: 'stand',
      },
    },
    update: {},
    create: {
      organizationId: manchesterOrg.id,
      key: 'stand',
      name: 'Aircraft Stand',
      description: 'Aircraft parking position',
      schema: {
        type: 'object',
        properties: {
          aircraftSize: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', 'F'] },
          hasPowerSupply: { type: 'boolean' },
          hasGroundSupport: { type: 'boolean' },
          maxWeight: { type: 'number' },
        },
      },
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  console.log('✅ Created asset type: stand');

  // Create stands for Manchester Airport
  for (const standData of manchesterStands) {
    const capabilities = {
      aircraftSize: standData.aircraftSize,
      hasPowerSupply: true,
      hasGroundSupport: standData.aircraftSize !== 'A' && standData.aircraftSize !== 'B',
      maxWeight:
        standData.aircraftSize === 'F'
          ? 560
          : standData.aircraftSize === 'E'
            ? 380
            : standData.aircraftSize === 'D'
              ? 250
              : 150,
    };

    const geometry = {
      type: 'Point',
      coordinates: [standData.lng, standData.lat],
    };

    const stand = await prisma.stand.upsert({
      where: {
        organizationId_code_isDeleted: {
          organizationId: manchesterOrg.id,
          code: standData.code,
          isDeleted: false,
        },
      },
      update: {},
      create: {
        organizationId: manchesterOrg.id,
        code: standData.code,
        name: standData.name,
        terminal: standData.terminal,
        status: 'operational',
        capabilities: capabilities,
        geometry: geometry,
        latitude: standData.lat,
        longitude: standData.lng,
        metadata: {
          seedData: true,
          airport: 'MAN',
        },
        createdBy: 'system',
        updatedBy: 'system',
      },
    });

    console.log(`✅ Created stand: ${stand.code} - ${stand.name}`);
  }

  // Create a few stands with different statuses
  await prisma.stand.update({
    where: {
      organizationId_code_isDeleted: {
        organizationId: manchesterOrg.id,
        code: '5',
        isDeleted: false,
      },
    },
    data: {
      status: 'maintenance',
      updatedBy: 'system',
    },
  });

  await prisma.standStatusHistory.create({
    data: {
      standId: (await prisma.stand.findFirst({ where: { code: '5' } }))!.id,
      fromStatus: 'operational',
      toStatus: 'maintenance',
      reason: 'Scheduled pavement maintenance',
      changedBy: 'system',
    },
  });

  console.log('✅ Updated stand 5 to maintenance status');

  console.log('✅ Assets module seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });
