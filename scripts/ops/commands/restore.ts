import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { prompt } from 'inquirer';

const execAsync = promisify(exec);

interface RestoreOptions {
  force?: boolean;
}

export async function restore(filePath: string, options: RestoreOptions) {
  try {
    // Check if backup file exists
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ Backup file not found: ${filePath}`));
      process.exit(1);
    }

    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(chalk.blue('\n🔄 Database Restore\n'));
    console.log(chalk.gray(`Backup file: ${filePath}`));
    console.log(chalk.gray(`Size: ${sizeMB} MB`));
    console.log(chalk.gray(`Modified: ${stats.mtime.toLocaleString()}`));

    // Get database connection details
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/capacity_planner';
    const urlParts = new URL(dbUrl);
    
    const host = urlParts.hostname;
    const port = urlParts.port || '5432';
    const database = urlParts.pathname.slice(1);
    const username = urlParts.username;
    const password = urlParts.password;

    console.log(chalk.gray(`\nTarget database: ${database} on ${host}:${port}`));

    // Confirm restore
    if (!options.force) {
      console.log(chalk.red.bold('\n⚠️  WARNING: This will completely replace the current database!'));
      console.log(chalk.red('All existing data will be lost.\n'));

      const { confirm } = await prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to restore from this backup?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\n❌ Restore cancelled\n'));
        return;
      }

      const { confirmDatabase } = await prompt([
        {
          type: 'input',
          name: 'confirmDatabase',
          message: `Type the database name "${database}" to confirm:`,
          validate: (value) => value === database || 'Database name does not match',
        },
      ]);

      if (confirmDatabase !== database) {
        console.log(chalk.yellow('\n❌ Restore cancelled\n'));
        return;
      }
    }

    console.log(chalk.yellow('\n🔄 Starting restore...\n'));

    // Set PGPASSWORD environment variable
    const env = { ...process.env, PGPASSWORD: password };

    // Drop existing connections
    console.log(chalk.gray('Terminating existing connections...'));
    const terminateCmd = `psql -h ${host} -p ${port} -U ${username} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();"`;
    await execAsync(terminateCmd, { env });

    // Drop and recreate database
    console.log(chalk.gray('Recreating database...'));
    const dropCmd = `psql -h ${host} -p ${port} -U ${username} -d postgres -c "DROP DATABASE IF EXISTS ${database};"`;
    await execAsync(dropCmd, { env });

    const createCmd = `psql -h ${host} -p ${port} -U ${username} -d postgres -c "CREATE DATABASE ${database};"`;
    await execAsync(createCmd, { env });

    // Create schemas
    console.log(chalk.gray('Creating schemas...'));
    const schemaCmd = `psql -h ${host} -p ${port} -U ${username} -d ${database} -c "CREATE SCHEMA IF NOT EXISTS entitlement; CREATE SCHEMA IF NOT EXISTS assets; CREATE SCHEMA IF NOT EXISTS work;"`;
    await execAsync(schemaCmd, { env });

    // Restore from backup
    console.log(chalk.gray('Restoring data...'));
    const restoreCmd = [
      'pg_restore',
      `-h ${host}`,
      `-p ${port}`,
      `-U ${username}`,
      `-d ${database}`,
      '--no-password',
      '--verbose',
      '--no-owner',
      '--no-privileges',
      filePath,
    ].join(' ');

    const { stdout, stderr } = await execAsync(restoreCmd, { env });
    
    if (stderr && !stderr.includes('WARNING')) {
      console.log(chalk.yellow('Warnings:'), stderr);
    }

    console.log(chalk.green('\n✅ Database restored successfully!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Restore failed:'), error);
    
    if (error instanceof Error && error.message.includes('pg_restore: command not found')) {
      console.log(chalk.yellow('\n💡 Make sure PostgreSQL client tools are installed:'));
      console.log(chalk.gray('   brew install postgresql (macOS)'));
      console.log(chalk.gray('   apt-get install postgresql-client (Ubuntu/Debian)'));
    }
    
    process.exit(1);
  }
}