const { PrismaClient } = require('../node_modules/.prisma/shared-kernel');

const prisma = new PrismaClient();

async function main() {
  try {
    // Check if admin org exists
    let adminOrg = await prisma.organization.findUnique({
      where: { code: 'ADM' },
    });

    if (!adminOrg) {
      adminOrg = await prisma.organization.create({
        data: {
          name: 'System Administration',
          code: 'ADM',
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
      console.log('Created admin organization:', adminOrg.name);
    }

    // Check if admin user exists
    const adminEmail = 'admin@capacity-planner.com';
    let adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'System Administrator',
          organizationId: adminOrg.id,
          role: 'admin-support',
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
      console.log('Created admin user:', adminEmail);
      console.log('Default password: admin123');
    } else {
      console.log('Admin user already exists:', adminEmail);
    }

    console.log('\nYou can now login to the admin portal at:');
    console.log('http://localhost:4200/admin');
    console.log('Email:', adminEmail);
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();