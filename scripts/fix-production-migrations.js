const { Client } = require('pg');

async function fixMigrations() {
  const client = new Client({
    connectionString: 'postgresql://postgres:P02BuEbqqgDet6gX@db.xwyzzwaxaciuspjwdmbn.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');

    // Check if _prisma_migrations table exists in each schema
    const schemas = ['public', 'entitlement', 'assets', 'work'];
    
    for (const schema of schemas) {
      console.log(`\n📋 Checking ${schema} schema...`);
      
      // Check if migrations table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = '_prisma_migrations'
        )
      `, [schema]);
      
      if (tableExists.rows[0].exists) {
        console.log(`Found _prisma_migrations table in ${schema}`);
        
        // Check for failed migrations
        const failed = await client.query(`
          SELECT id, migration_name, started_at, finished_at 
          FROM ${schema}._prisma_migrations 
          WHERE finished_at IS NULL
        `);
        
        if (failed.rows.length > 0) {
          console.log(`❌ Found ${failed.rows.length} failed migration(s):`);
          failed.rows.forEach(row => {
            console.log(`  - ${row.migration_name} (started: ${row.started_at})`);
          });
          
          // Remove failed migrations
          await client.query(`
            DELETE FROM ${schema}._prisma_migrations 
            WHERE finished_at IS NULL
          `);
          console.log(`✅ Removed failed migrations from ${schema}`);
        } else {
          console.log(`✅ No failed migrations in ${schema}`);
        }
      } else {
        console.log(`No _prisma_migrations table in ${schema} (will be created on first migration)`);
      }
    }

    console.log('\n✅ Migration history cleaned up!');
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixMigrations();