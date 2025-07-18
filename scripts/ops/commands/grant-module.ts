import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import chalk from 'chalk';

// Inline module definitions
const MODULES = [
  { key: 'assets', name: 'Assets Module' },
  { key: 'work', name: 'Work Module' },
  { key: 'capacity', name: 'Capacity Module' },
  { key: 'planning', name: 'Planning Module' },
  { key: 'monitoring', name: 'Monitoring Module' },
];

const prisma = new PrismaClient();

interface GrantModuleOptions {
  org: string;
  module: string;
  until?: string;
}

export async function grantModule(options: GrantModuleOptions) {
  try {
    // Validate module key
    const validModules = MODULES.map(m => m.key);
    if (!validModules.includes(options.module)) {
      console.log(chalk.red(`❌ Invalid module key: ${options.module}`));
      console.log(chalk.yellow(`Valid modules: ${validModules.join(', ')}`));
      process.exit(1);
    }

    // Find organization by code
    const org = await prisma.organization.findUnique({
      where: { code: options.org.toUpperCase() },
    });

    if (!org) {
      console.log(chalk.red(`❌ Organization with code ${options.org} not found`));
      process.exit(1);
    }

    // Check if already has access
    const existing = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM entitlement.entitlements
      WHERE organization_id = ${org.id}
      AND module_key = ${options.module}
      AND status = 'active'
    `;

    if (Number(existing[0].count) > 0) {
      console.log(chalk.yellow(`⚠️  ${org.name} already has access to ${options.module} module`));
      
      // Update to ensure it's active
      await prisma.$executeRaw`
        UPDATE entitlement.entitlements
        SET status = 'active',
            updated_by = 'cli-tool',
            updated_at = NOW()
            ${options.until ? `, valid_until = ${new Date(options.until)}::timestamp` : ''}
        WHERE organization_id = ${org.id}
        AND module_key = ${options.module}
      `;
      
      console.log(chalk.green('✅ Updated existing entitlement'));
    } else {
      // Grant new access
      await prisma.$executeRaw`
        INSERT INTO entitlement.entitlements (
          id, organization_id, module_key, status, updated_by, updated_at
          ${options.until ? ', valid_until' : ''}
        ) VALUES (
          gen_random_uuid(),
          ${org.id},
          ${options.module},
          'active',
          'cli-tool',
          NOW()
          ${options.until ? `, ${new Date(options.until)}::timestamp` : ''}
        )
      `;
      
      console.log(chalk.green(`✅ Granted ${org.name} (${org.code}) access to ${options.module} module`));
    }

    if (options.until) {
      console.log(chalk.blue(`   Valid until: ${options.until}`));
    }

  } catch (error) {
    console.error(chalk.red('Error granting module access:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}