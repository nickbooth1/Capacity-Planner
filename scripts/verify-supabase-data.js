const { Client } = require('pg');

async function verifyData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Check organizations
    console.log('📊 Organizations:');
    const orgs = await client.query('SELECT * FROM public.organizations');
    orgs.rows.forEach(org => {
      console.log(`  - ${org.name} (${org.code})`);
    });

    // Check users
    console.log('\n👥 Users:');
    const users = await client.query('SELECT u.name, u.role, o.code FROM public.users u JOIN public.organizations o ON u."organizationId" = o.id');
    users.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.role}) - ${user.code}`);
    });

    // Check entitlements
    console.log('\n🔑 Entitlements:');
    const entitlements = await client.query('SELECT e.module_key, e.status, o.code FROM entitlement.entitlements e JOIN public.organizations o ON e.organization_id = o.id');
    entitlements.rows.forEach(ent => {
      console.log(`  - ${ent.code}: ${ent.module_key} (${ent.status})`);
    });

    // Check stands
    console.log('\n✈️  Stands:');
    const stands = await client.query('SELECT COUNT(*) as total, terminal FROM assets.stands GROUP BY terminal ORDER BY terminal');
    stands.rows.forEach(row => {
      console.log(`  - Terminal ${row.terminal || 'Remote'}: ${row.total} stands`);
    });

    // Check work requests
    console.log('\n🔧 Work Requests:');
    const requests = await client.query('SELECT status, COUNT(*) as count FROM work.work_requests GROUP BY status');
    requests.rows.forEach(req => {
      console.log(`  - ${req.status}: ${req.count}`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyData();