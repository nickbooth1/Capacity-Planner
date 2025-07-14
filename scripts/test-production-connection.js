const { Client } = require('pg');

async function testConnection() {
  // Test with Transaction Pooler
  console.log('🔍 Testing Production Database Connection...\n');
  
  const poolerClient = new Client({
    connectionString: 'postgres://postgres.xwyzzwaxaciuspjwdmbn:P02BuEbqqgDet6gX@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
    ssl: { 
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting via Transaction Pooler...');
    await poolerClient.connect();
    console.log('✅ Connected successfully via Transaction Pooler!');
    
    // Test a simple query
    const result = await poolerClient.query('SELECT current_database(), version()');
    console.log('\n📊 Database info:');
    console.log(`  - Database: ${result.rows[0].current_database}`);
    console.log(`  - Version: ${result.rows[0].version.split(',')[0]}`);
    
    // Check our schemas
    const schemas = await poolerClient.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'entitlement', 'assets', 'work')
      ORDER BY schema_name
    `);
    
    console.log('\n📁 Available schemas:');
    schemas.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });
    
    // Quick data check
    const orgCount = await poolerClient.query('SELECT COUNT(*) as count FROM public.organizations');
    console.log(`\n🏢 Organizations: ${orgCount.rows[0].count}`);
    
    await poolerClient.end();
    console.log('\n✅ All connection tests passed!');
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.error('\nFull error:', error);
    
    // Try direct connection as fallback test
    console.log('\n🔄 Testing direct connection as fallback...');
    const directClient = new Client({
      connectionString: 'postgresql://postgres:P02BuEbqqgDet6gX@db.xwyzzwaxaciuspjwdmbn.supabase.co:5432/postgres',
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await directClient.connect();
      console.log('✅ Direct connection works (but pooler is recommended for production)');
      await directClient.end();
    } catch (directError) {
      console.error('❌ Direct connection also failed:', directError.message);
    }
  }
}

testConnection();