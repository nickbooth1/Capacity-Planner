import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import { prompt } from 'inquirer';
import chalk from 'chalk';

// Inline module definitions to avoid import issues
const MODULES = [
  { key: 'assets', name: 'Assets Module', description: 'Manage airport assets' },
  { key: 'work', name: 'Work Module', description: 'Schedule and track work' },
  { key: 'capacity', name: 'Capacity Module', description: 'Monitor capacity' },
  { key: 'planning', name: 'Planning Module', description: 'Planning tools' },
  { key: 'monitoring', name: 'Monitoring Module', description: 'Real-time monitoring' },
];

const prisma = new PrismaClient();

export async function createOrganization() {
  try {
    console.log(chalk.blue('\n📋 Create New Organization\n'));

    // Prompt for organization details
    const answers = await prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Organization name:',
        validate: (value) => value.length > 0 || 'Name is required',
      },
      {
        type: 'input',
        name: 'code',
        message: 'IATA code (3 letters):',
        validate: (value) => /^[A-Z]{3}$/.test(value.toUpperCase()) || 'Must be 3 uppercase letters',
        transformer: (value) => value.toUpperCase(),
      },
      {
        type: 'checkbox',
        name: 'modules',
        message: 'Select modules to grant access:',
        choices: MODULES.map(m => ({
          name: `${m.name} - ${m.description}`,
          value: m.key,
          checked: false,
        })),
        validate: (value) => value.length > 0 || 'Select at least one module',
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create organization with these settings?',
        default: true,
      },
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('❌ Organization creation cancelled'));
      return;
    }

    // Check if org already exists
    const existing = await prisma.organization.findUnique({
      where: { code: answers.code.toUpperCase() },
    });

    if (existing) {
      console.log(chalk.red(`❌ Organization with code ${answers.code} already exists`));
      return;
    }

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: answers.name,
        code: answers.code.toUpperCase(),
        createdBy: 'cli-tool',
        updatedBy: 'cli-tool',
      },
    });

    console.log(chalk.green(`✅ Created organization: ${org.name} (${org.code})`));

    // Grant module access
    for (const moduleKey of answers.modules) {
      await prisma.$executeRaw`
        INSERT INTO entitlement.entitlements (
          id, organization_id, module_key, status, updated_by, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${org.id},
          ${moduleKey},
          'active',
          'cli-tool',
          NOW()
        )
      `;
      console.log(chalk.green(`  ✅ Granted access to ${moduleKey} module`));
    }

    console.log(chalk.blue('\n✨ Organization created successfully!\n'));

  } catch (error) {
    console.error(chalk.red('Error creating organization:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}