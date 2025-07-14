const { Client } = require('pg');

async function checkSchemas() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase');

    // Check existing schemas
    const schemaQuery = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `;
    
    const result = await client.query(schemaQuery);
    console.log('\n📁 Existing schemas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });

    // Check if our schemas exist
    const requiredSchemas = ['entitlement', 'assets', 'work'];
    const existingSchemas = result.rows.map(r => r.schema_name);
    const missingSchemas = requiredSchemas.filter(s => !existingSchemas.includes(s));

    if (missingSchemas.length > 0) {
      console.log('\n⚠️  Missing schemas:', missingSchemas.join(', '));
      console.log('\nRun the following SQL in Supabase SQL Editor to create them:');
      console.log('```sql');
      missingSchemas.forEach(schema => {
        console.log(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
      });
      console.log('```');
    } else {
      console.log('\n✅ All required schemas exist!');
    }

    // Check tables in each schema
    console.log('\n📊 Tables in each schema:');
    for (const schema of existingSchemas) {
      const tableQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const tables = await client.query(tableQuery, [schema]);
      console.log(`\n  ${schema}:`);
      if (tables.rows.length === 0) {
        console.log('    (no tables)');
      } else {
        tables.rows.forEach(row => {
          console.log(`    - ${row.table_name}`);
        });
      }
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchemas();