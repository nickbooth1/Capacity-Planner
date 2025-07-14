const { Client } = require('pg');

async function checkMigrations() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Check _prisma_migrations tables in each schema
    const schemas = ['public', 'entitlement', 'assets', 'work'];
    
    for (const schema of schemas) {
      console.log(`📊 Checking ${schema}._prisma_migrations:`);
      
      try {
        const query = `
          SELECT id, migration_name, applied_steps_count, finished_at 
          FROM ${schema}._prisma_migrations 
          ORDER BY finished_at DESC
          LIMIT 5;
        `;
        
        const result = await client.query(query);
        
        if (result.rows.length === 0) {
          console.log('  No migrations found');
        } else {
          result.rows.forEach(row => {
            console.log(`  - ${row.migration_name} (applied: ${row.applied_steps_count}, finished: ${row.finished_at ? row.finished_at.toISOString() : 'pending'})`);
          });
        }
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log('  ❌ _prisma_migrations table does not exist');
        } else {
          console.log('  ❌ Error:', error.message);
        }
      }
      console.log('');
    }

    // List actual tables in each schema
    console.log('\n📁 Actual tables in schemas:');
    for (const schema of schemas) {
      const tableQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const tables = await client.query(tableQuery, [schema]);
      console.log(`\n${schema}:`);
      if (tables.rows.length === 0) {
        console.log('  (no tables)');
      } else {
        tables.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
      }
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMigrations();