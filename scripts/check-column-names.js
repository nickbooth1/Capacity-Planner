const { Client } = require('pg');

async function checkColumns() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check column names in users table
    const userCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    console.log('\nUsers table columns:');
    userCols.rows.forEach(col => console.log(`  - ${col.column_name}`));

    // Check column names in entitlements table
    const entCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'entitlement' AND table_name = 'entitlements'
    `);
    console.log('\nEntitlements table columns:');
    entCols.rows.forEach(col => console.log(`  - ${col.column_name}`));

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkColumns();