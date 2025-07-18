#!/usr/bin/env tsx
import { Command } from 'commander';
import { createOrganization } from './commands/create-org';
import { grantModule } from './commands/grant-module';
import { listOrganizations } from './commands/list-orgs';
import { bulkImport } from './commands/bulk-import';
import { healthCheck } from './commands/health-check';
import { backup } from './commands/backup';
import { restore } from './commands/restore';

const program = new Command();

program
  .name('capacity-ops')
  .description('CapaCity Planner operational tools')
  .version('1.0.0');

// Organization management commands
program
  .command('create-org')
  .description('Create a new organization interactively')
  .action(createOrganization);

program
  .command('grant-module')
  .description('Grant module access to an organization')
  .requiredOption('-o, --org <code>', 'Organization IATA code')
  .requiredOption('-m, --module <key>', 'Module key (assets, work, capacity, planning, monitoring)')
  .option('-u, --until <date>', 'Valid until date (YYYY-MM-DD)')
  .action(grantModule);

program
  .command('list-orgs')
  .description('List all organizations and their modules')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(listOrganizations);

// Bulk operations
program
  .command('bulk-import <file>')
  .description('Import organizations from CSV file')
  .option('-d, --dry-run', 'Preview import without making changes')
  .action(bulkImport);

// System operations
program
  .command('health-check')
  .description('Check health of all services')
  .option('-v, --verbose', 'Show detailed health information')
  .action(healthCheck);

program
  .command('backup')
  .description('Backup the database')
  .option('-o, --output <file>', 'Output file path', `./backups/backup-${new Date().toISOString().split('T')[0]}.sql`)
  .action(backup);

program
  .command('restore <file>')
  .description('Restore database from backup')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(restore);

program.parse();