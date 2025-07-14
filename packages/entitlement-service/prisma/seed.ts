import { PrismaClient } from '../../../node_modules/.prisma/entitlement-service';
import { PrismaClient as SharedPrismaClient } from '../../../node_modules/.prisma/shared-kernel';

const prisma = new PrismaClient();
const sharedPrisma = new SharedPrismaClient();

async function main() {
  console.log('🌱 Seeding entitlement-service database...');

  // Get organizations from shared-kernel
  const organizations = await sharedPrisma.organization.findMany();

  for (const org of organizations) {
    console.log(`Setting up entitlements for ${org.name}...`);

    // Manchester Airport gets all modules
    if (org.code === 'MAN') {
      const modules = ['assets', 'work', 'capacity'];

      for (const moduleKey of modules) {
        const entitlement = await prisma.entitlement.upsert({
          where: {
            organizationId_moduleKey: {
              organizationId: org.id,
              moduleKey: moduleKey,
            },
          },
          update: {},
          create: {
            organizationId: org.id,
            moduleKey: moduleKey,
            status: 'active',
            validUntil: new Date('2025-12-31'),
            createdBy: 'system',
            updatedBy: 'system',
          },
        });

        console.log(`✅ Created entitlement: ${org.code} - ${moduleKey}`);

        // Create audit entry
        await prisma.entitlementAudit.create({
          data: {
            entitlementId: entitlement.id,
            organizationId: org.id,
            moduleKey: moduleKey,
            action: 'created',
            newValue: {
              status: 'active',
              validUntil: '2025-12-31',
            },
            performedBy: 'system',
            reason: 'Initial setup',
          },
        });
      }
    }
  }

  console.log('✅ Entitlement seeding completed!');
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
