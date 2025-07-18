import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import chalk from 'chalk';
import Table from 'cli-table3';

const prisma = new PrismaClient();

interface ListOptions {
  format: 'table' | 'json';
}

export async function listOrganizations(options: ListOptions) {
  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Get entitlements for each org
    const orgsWithModules = await Promise.all(
      organizations.map(async (org) => {
        const entitlements = await prisma.$queryRaw<
          { module_key: string; status: string; valid_until: Date | null }[]
        >`
          SELECT module_key, status, valid_until
          FROM entitlement.entitlements
          WHERE organization_id = ${org.id}
          AND status = 'active'
          ORDER BY module_key
        `;

        return {
          ...org,
          modules: entitlements.map(e => ({
            key: e.module_key,
            validUntil: e.valid_until,
          })),
        };
      })
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(orgsWithModules, null, 2));
      return;
    }

    // Display as table
    const table = new Table({
      head: [
        chalk.cyan('Code'),
        chalk.cyan('Name'),
        chalk.cyan('Active Modules'),
        chalk.cyan('Created'),
      ],
      style: {
        head: [],
        border: [],
      },
    });

    for (const org of orgsWithModules) {
      const moduleList = org.modules
        .map(m => {
          let str = m.key;
          if (m.validUntil) {
            const expiry = new Date(m.validUntil);
            const isExpired = expiry < new Date();
            str += isExpired 
              ? chalk.red(` (expired ${expiry.toISOString().split('T')[0]})`)
              : chalk.yellow(` (until ${expiry.toISOString().split('T')[0]})`);
          }
          return str;
        })
        .join(', ') || chalk.gray('none');

      table.push([
        chalk.bold(org.code),
        org.name,
        moduleList,
        new Date(org.createdAt).toISOString().split('T')[0],
      ]);
    }

    console.log('\n' + chalk.blue.bold('Organizations') + '\n');
    console.log(table.toString());
    console.log(`\n${chalk.gray(`Total: ${organizations.length} organizations`)}\n`);

  } catch (error) {
    console.error(chalk.red('Error listing organizations:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}