import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import chalk from 'chalk';
import fs from 'fs';
import csv from 'csv-parser';

// Inline module definitions
const MODULES = [
  { key: 'assets', name: 'Assets Module' },
  { key: 'work', name: 'Work Module' },
  { key: 'capacity', name: 'Capacity Module' },
  { key: 'planning', name: 'Planning Module' },
  { key: 'monitoring', name: 'Monitoring Module' },
];

const prisma = new PrismaClient();

interface BulkImportOptions {
  dryRun?: boolean;
}

interface ImportRow {
  name: string;
  code: string;
  modules: string;
}

export async function bulkImport(filePath: string, options: BulkImportOptions) {
  const results: ImportRow[] = [];
  const errors: string[] = [];
  const validModules = MODULES.map(m => m.key);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }

    console.log(chalk.blue(`\n📁 Reading CSV file: ${filePath}\n`));

    // Read and parse CSV
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          // Validate row
          if (!row.name || !row.code || !row.modules) {
            errors.push(`Invalid row: ${JSON.stringify(row)}`);
            return;
          }

          const code = row.code.toUpperCase();
          if (!/^[A-Z]{3}$/.test(code)) {
            errors.push(`Invalid IATA code: ${code}`);
            return;
          }

          const modules = row.modules.split(',').map((m: string) => m.trim());
          const invalidModules = modules.filter(m => !validModules.includes(m));
          
          if (invalidModules.length > 0) {
            errors.push(`Invalid modules for ${code}: ${invalidModules.join(', ')}`);
            return;
          }

          results.push({
            name: row.name,
            code,
            modules: row.modules,
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Display errors if any
    if (errors.length > 0) {
      console.log(chalk.red('❌ Validation errors:'));
      errors.forEach(err => console.log(chalk.red(`   - ${err}`)));
      console.log('');
    }

    // Display what will be imported
    console.log(chalk.yellow(`Found ${results.length} valid organizations to import:\n`));
    
    for (const row of results) {
      console.log(`  • ${chalk.bold(row.code)} - ${row.name}`);
      console.log(`    Modules: ${row.modules}`);
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\n✋ Dry run mode - no changes made\n'));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.yellow('No valid organizations to import\n'));
      return;
    }

    // Confirm import
    console.log('');
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      readline.question(chalk.cyan('Proceed with import? (y/N): '), (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });

    if (!confirmed) {
      console.log(chalk.yellow('\n❌ Import cancelled\n'));
      return;
    }

    // Perform import
    console.log(chalk.blue('\n🚀 Starting import...\n'));

    let created = 0;
    let skipped = 0;

    for (const row of results) {
      try {
        // Check if org exists
        const existing = await prisma.organization.findUnique({
          where: { code: row.code },
        });

        if (existing) {
          console.log(chalk.yellow(`⚠️  Skipping ${row.code} - already exists`));
          skipped++;
          continue;
        }

        // Create organization
        const org = await prisma.organization.create({
          data: {
            name: row.name,
            code: row.code,
            createdBy: 'bulk-import',
            updatedBy: 'bulk-import',
          },
        });

        // Grant modules
        const modules = row.modules.split(',').map(m => m.trim());
        for (const moduleKey of modules) {
          await prisma.$executeRaw`
            INSERT INTO entitlement.entitlements (
              id, organization_id, module_key, status, updated_by, updated_at
            ) VALUES (
              gen_random_uuid(),
              ${org.id},
              ${moduleKey},
              'active',
              'bulk-import',
              NOW()
            )
          `;
        }

        console.log(chalk.green(`✅ Created ${org.name} (${org.code}) with modules: ${modules.join(', ')}`));
        created++;

      } catch (error) {
        console.log(chalk.red(`❌ Error importing ${row.code}: ${error}`));
      }
    }

    console.log(chalk.blue(`\n✨ Import complete!`));
    console.log(chalk.green(`   Created: ${created} organizations`));
    if (skipped > 0) {
      console.log(chalk.yellow(`   Skipped: ${skipped} organizations (already exist)`));
    }
    console.log('');

  } catch (error) {
    console.error(chalk.red('Error during import:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}