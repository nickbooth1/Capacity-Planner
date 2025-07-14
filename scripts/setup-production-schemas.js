const { Client } = require('pg');

async function setupSchemas() {
  const client = new Client({
    connectionString: 'postgresql://postgres:P02BuEbqqgDet6gX@db.xwyzzwaxaciuspjwdmbn.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase production database');

    // Create schemas
    console.log('\n📁 Creating schemas...');
    
    await client.query('CREATE SCHEMA IF NOT EXISTS public');
    console.log('✅ Created public schema');
    
    await client.query('CREATE SCHEMA IF NOT EXISTS entitlement');
    console.log('✅ Created entitlement schema');
    
    await client.query('CREATE SCHEMA IF NOT EXISTS assets');
    console.log('✅ Created assets schema');
    
    await client.query('CREATE SCHEMA IF NOT EXISTS work');
    console.log('✅ Created work schema');

    // Verify schemas
    console.log('\n🔍 Verifying schemas...');
    const result = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'entitlement', 'assets', 'work')
      ORDER BY schema_name
    `);
    
    console.log('Found schemas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });

    console.log('\n✅ All schemas created successfully!');
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupSchemas();