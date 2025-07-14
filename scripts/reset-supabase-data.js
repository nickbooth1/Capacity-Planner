const { Client } = require('pg');

async function resetData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase');

    console.log('\n🗑️  Truncating tables in reverse dependency order...');

    // Work module tables
    await client.query('TRUNCATE work.work_request_notifications CASCADE');
    await client.query('TRUNCATE work.work_request_comments CASCADE');
    await client.query('TRUNCATE work.work_request_status_history CASCADE');
    await client.query('TRUNCATE work.work_requests CASCADE');
    await client.query('TRUNCATE work.work_request_templates CASCADE');
    console.log('✅ Cleared work module tables');

    // Assets module tables
    await client.query('TRUNCATE assets.stand_status_history CASCADE');
    await client.query('TRUNCATE assets.stands CASCADE');
    await client.query('TRUNCATE assets.assets CASCADE');
    await client.query('TRUNCATE assets.asset_types CASCADE');
    console.log('✅ Cleared assets module tables');

    // Entitlement module tables
    await client.query('TRUNCATE entitlement.entitlement_audits CASCADE');
    await client.query('TRUNCATE entitlement.entitlements CASCADE');
    console.log('✅ Cleared entitlement module tables');

    // Public schema tables
    await client.query('TRUNCATE public.users CASCADE');
    await client.query('TRUNCATE public.organizations CASCADE');
    console.log('✅ Cleared public schema tables');

    console.log('\n✅ All data cleared successfully!');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetData();