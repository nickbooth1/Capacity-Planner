import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface BackupOptions {
  output: string;
}

export async function backup(options: BackupOptions) {
  try {
    console.log(chalk.blue('\n💾 Starting database backup...\n'));

    // Ensure backup directory exists
    const backupDir = path.dirname(options.output);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Get database connection details
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/capacity_planner';
    const urlParts = new URL(dbUrl);
    
    const host = urlParts.hostname;
    const port = urlParts.port || '5432';
    const database = urlParts.pathname.slice(1);
    const username = urlParts.username;
    const password = urlParts.password;

    console.log(chalk.gray(`Database: ${database} on ${host}:${port}`));
    console.log(chalk.gray(`Output: ${options.output}`));

    // Build pg_dump command
    const pgDumpCmd = [
      'pg_dump',
      `-h ${host}`,
      `-p ${port}`,
      `-U ${username}`,
      `-d ${database}`,
      '--no-password',
      '--verbose',
      '--schema=public',
      '--schema=entitlement',
      '--schema=assets',
      '--schema=work',
      '--format=custom',
      '--no-privileges',
      '--no-owner',
      `-f ${options.output}`,
    ].join(' ');

    // Set PGPASSWORD environment variable
    const env = { ...process.env, PGPASSWORD: password };

    console.log(chalk.yellow('\n🔄 Running backup...\n'));
    
    const { stdout, stderr } = await execAsync(pgDumpCmd, { env });
    
    if (stderr && !stderr.includes('pg_dump: saving')) {
      console.log(chalk.yellow('Warnings:'), stderr);
    }

    // Verify backup file was created
    if (fs.existsSync(options.output)) {
      const stats = fs.statSync(options.output);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(chalk.green(`\n✅ Backup completed successfully!`));
      console.log(chalk.green(`   File: ${options.output}`));
      console.log(chalk.green(`   Size: ${sizeMB} MB`));
      console.log('');
    } else {
      throw new Error('Backup file was not created');
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Backup failed:'), error);
    
    if (error instanceof Error && error.message.includes('pg_dump: command not found')) {
      console.log(chalk.yellow('\n💡 Make sure PostgreSQL client tools are installed:'));
      console.log(chalk.gray('   brew install postgresql (macOS)'));
      console.log(chalk.gray('   apt-get install postgresql-client (Ubuntu/Debian)'));
    }
    
    process.exit(1);
  }
}