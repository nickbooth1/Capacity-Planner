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
