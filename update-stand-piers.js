const { PrismaClient } = require('./node_modules/.prisma/assets-module');

const prisma = new PrismaClient();

async function updateStandPiers() {
  console.log('Updating stand pier assignments...');
  
  // Get Manchester org ID
  const sharedPrisma = new (require('./node_modules/.prisma/shared-kernel').PrismaClient)();
  const org = await sharedPrisma.organization.findUnique({
    where: { code: 'MAN' }
  });
  
  if (!org) {
    console.error('Manchester Airport organization not found');
    return;
  }

  // Terminal 1 - Pier A (stands 1-4), Pier B (stands 5-8)
  for (let i = 1; i <= 4; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'A' }
    });
  }
  
  for (let i = 5; i <= 8; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'B' }
    });
  }
  
  // Terminal 2 - Pier C (stands 20-23), Pier D (stands 24-27)
  for (let i = 20; i <= 23; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'C' }
    });
  }
  
  for (let i = 24; i <= 27; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'D' }
    });
  }
  
  // Terminal 3 - Pier E (stands 40-43), Pier F (stands 44-47)
  for (let i = 40; i <= 43; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'E' }
    });
  }
  
  for (let i = 44; i <= 47; i++) {
    await prisma.stand.updateMany({
      where: { 
        code: i.toString(),
        organizationId: org.id,
        isDeleted: false
      },
      data: { pier: 'F' }
    });
  }
  
  console.log('✅ Updated stand pier assignments');
  
  // Show summary
  const standCounts = await prisma.stand.groupBy({
    by: ['terminal', 'pier'],
    where: { organizationId: org.id, isDeleted: false },
    _count: true,
    orderBy: [{ terminal: 'asc' }, { pier: 'asc' }]
  });
  
  console.log('\nStand distribution:');
  standCounts.forEach(({ terminal, pier, _count }) => {
    console.log(`  ${terminal || 'Remote'} - ${pier || 'No pier'}: ${_count} stands`);
  });
  
  await prisma.$disconnect();
  await sharedPrisma.$disconnect();
}

updateStandPiers().catch(console.error);