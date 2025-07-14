const { Client } = require('pg');

// Test different connection configurations
async function testConnection(config, label) {
  console.log(`\n🔍 Testing ${label}...`);
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT current_database(), current_schemas(false)');
    console.log('📊 Database:', result.rows[0].current_database);
    console.log('📁 Schemas:', result.rows[0].current_schemas);
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function main() {
  // Configuration 1: Direct connection with SSL
  await testConnection({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  }, 'Direct connection with SSL');

  // Configuration 2: Pooled connection (if available)
  await testConnection({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  }, 'Pooled connection');

  // Configuration 3: With explicit SSL mode
  await testConnection({
    host: 'db.aygstuxsnkqrzjnbytmg.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Svt9rBOwkDyopoOp',
    ssl: { rejectUnauthorized: false }
  }, 'Direct with explicit SSL params');
}

// Check if pg is installed
try {
  require('pg');
  main();
} catch (error) {
  console.log('📦 Installing pg package...');
  require('child_process').execSync('npm install pg', { stdio: 'inherit' });
  console.log('✅ Package installed. Please run the script again.');
}