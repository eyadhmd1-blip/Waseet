// Waseet seed script — run with: node seed.js
const { createClient } = require('../mobile/node_modules/@supabase/supabase-js');

const URL = 'https://bkbjsstxhvdnqcmpuulf.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYmpzc3R4aHZkbnFjbXB1dWxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyNjc4NywiZXhwIjoyMDkxODAyNzg3fQ.JfE_DLW4jB6_E1MjaOFCSj56n6Tr0jhfQXwFqhKd1V0';
const s = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function createAuthUser(phone, name) {
  const { data: list } = await s.auth.admin.listUsers();
  const old = list?.users?.find(u => u.phone === phone);
  if (old) {
    await s.auth.admin.deleteUser(old.id);
    console.log('  removed old user', phone);
  }
  const { data, error } = await s.auth.admin.createUser({
    phone,
    phone_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) { console.error('  ERR', phone, error.message); return null; }
  console.log('  created', phone, '->', data.user.id);
  return data.user.id;
}

async function seed() {
  console.log('\n=== Waseet Seed ===\n');

  // 1. Auth users
  console.log('1. Creating auth users...');
  const clientId = await createAuthUser('+96279000001', '\u0623\u062d\u0645\u062f \u0627\u0644\u0639\u0645\u064a\u0644');
  const prov1Id  = await createAuthUser('+96279000002', '\u0645\u062d\u0645\u062f \u0627\u0644\u0633\u0628\u0627\u0643');
  const prov2Id  = await createAuthUser('+96279000003', '\u062e\u0627\u0644\u062f \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a');
  if (!clientId || !prov1Id || !prov2Id) { console.error('FAILED'); return; }

  // 2. Public users
  console.log('\n2. Inserting public users...');
  const { error: uErr } = await s.from('users').upsert([
    { id: clientId, role: 'client',   full_name: '\u0623\u062d\u0645\u062f \u0627\u0644\u0639\u0645\u064a\u0644',    phone: '+96279000001', phone_verified: true, city: '\u0639\u0645\u0627\u0646' },
    { id: prov1Id,  role: 'provider', full_name: '\u0645\u062d\u0645\u062f \u0627\u0644\u0633\u0628\u0627\u0643',    phone: '+96279000002', phone_verified: true, city: '\u0639\u0645\u0627\u0646' },
    { id: prov2Id,  role: 'provider', full_name: '\u062e\u0627\u0644\u062f \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a', phone: '+96279000003', phone_verified: true, city: '\u0639\u0645\u0627\u0646' },
  ], { onConflict: 'id' });
  if (uErr) { console.error('  ERR', uErr.message); return; }
  console.log('  3 users OK');

  // 3. Providers
  console.log('\n3. Inserting provider profiles...');
  const subEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: pErr } = await s.from('providers').upsert([
    {
      id: prov1Id,
      bio: '\u0633\u0628\u0627\u0643 \u0645\u062d\u062a\u0631\u0641 \u0628\u062e\u0628\u0631\u0629 10 \u0633\u0646\u0648\u0627\u062a.',
      categories: ['plumbing', 'cleaning'],
      score: 4.7,
      reputation_tier: 'trusted',
      lifetime_jobs: 42,
      is_subscribed: true,
      subscription_tier: 'pro',
      subscription_ends: subEnd,
      badge_verified: true,
      bid_credits: 45,
      trial_used: true,
    },
    {
      id: prov2Id,
      bio: '\u0643\u0647\u0631\u0628\u0627\u0626\u064a \u0645\u0639\u062a\u0645\u062f.',
      categories: ['electrical'],
      score: 4.2,
      reputation_tier: 'rising',
      lifetime_jobs: 18,
      is_subscribed: true,
      subscription_tier: 'basic',
      subscription_ends: subEnd,
      badge_verified: false,
      bid_credits: 14,
      trial_used: true,
    },
  ], { onConflict: 'id' });
  if (pErr) { console.error('  ERR', pErr.message); return; }
  console.log('  2 providers OK');

  // 4. Requests
  console.log('\n4. Creating requests...');
  await s.from('requests').delete().eq('client_id', clientId);
  const { data: reqs, error: rErr } = await s.from('requests').insert([
    {
      client_id: clientId, category_slug: 'plumbing',
      title: '\u0625\u0635\u0644\u0627\u062d \u062a\u0633\u0631\u0628 \u0645\u064a\u0627\u0647 \u0641\u064a \u0627\u0644\u062d\u0645\u0627\u0645',
      description: '\u064a\u0648\u062c\u062f \u062a\u0633\u0631\u0628 \u062a\u062d\u062a \u0627\u0644\u0645\u063a\u0633\u0644\u0629.',
      city: '\u0639\u0645\u0627\u0646', district: '\u0627\u0644\u0631\u0627\u0628\u064a\u0629',
      status: 'open', ai_suggested_price_min: 25, ai_suggested_price_max: 60,
    },
    {
      client_id: clientId, category_slug: 'electrical',
      title: '\u062a\u0631\u0643\u064a\u0628 \u0644\u0648\u062d\u0629 \u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629 \u062c\u062f\u064a\u062f\u0629',
      description: '\u0623\u0631\u064a\u062f \u062a\u0631\u0643\u064a\u0628 \u0644\u0648\u062d\u0629 \u062a\u0648\u0632\u064a\u0639 12 \u062e\u0637.',
      city: '\u0639\u0645\u0627\u0646', district: '\u0627\u0644\u062c\u0628\u064a\u0647\u0629',
      status: 'open', ai_suggested_price_min: 80, ai_suggested_price_max: 150,
    },
    {
      client_id: clientId, category_slug: 'plumbing',
      title: '\u062a\u0645\u062f\u064a\u062f \u062e\u0637 \u0645\u064a\u0627\u0647 \u0644\u0644\u0645\u0637\u0628\u062e',
      description: '\u062a\u0645\u062f\u064a\u062f \u0628\u0627\u0631\u062f \u0648\u0633\u0627\u062e\u0646 \u0644\u063a\u0633\u0627\u0644\u0629 \u0627\u0644\u0635\u062d\u0648\u0646.',
      city: '\u0639\u0645\u0627\u0646', district: '\u0645\u0631\u062c \u0627\u0644\u062d\u0645\u0627\u0645',
      status: 'in_progress', ai_suggested_price_min: 40, ai_suggested_price_max: 90,
    },
  ]).select();
  if (rErr || !reqs) { console.error('  ERR', rErr?.message); return; }
  console.log('  3 requests OK');

  // 5. Bids
  console.log('\n5. Creating bids...');
  await s.from('bids').delete().in('request_id', reqs.map(r => r.id));
  const { data: bids, error: bErr } = await s.from('bids').insert([
    { request_id: reqs[0].id, provider_id: prov1Id, amount: 35,  note: '\u0623\u0642\u062f\u0631 \u0623\u062c\u064a \u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u062a\u064a\u0646.', status: 'pending',  credit_cost: 1 },
    { request_id: reqs[0].id, provider_id: prov2Id, amount: 45,  note: '\u0623\u0639\u0645\u0644 \u0628\u0636\u0645\u0627\u0646 \u0643\u0627\u0645\u0644.',                 status: 'pending',  credit_cost: 1 },
    { request_id: reqs[1].id, provider_id: prov2Id, amount: 120, note: '\u062e\u0628\u0631\u0629 \u0641\u064a Schneider \u0648ABB.',               status: 'pending',  credit_cost: 1 },
    { request_id: reqs[2].id, provider_id: prov1Id, amount: 55,  note: '\u062c\u0627\u0647\u0632 \u063a\u062f\u0627\u064b \u0627\u0644\u0635\u0628\u0627\u062d.',         status: 'accepted', credit_cost: 1 },
  ]).select();
  if (bErr || !bids) { console.error('  ERR', bErr?.message); return; }
  console.log('  4 bids OK');

  // 6. Job
  console.log('\n6. Creating active job...');
  await s.from('jobs').delete().eq('request_id', reqs[2].id);
  const { data: job, error: jErr } = await s.from('jobs').insert({
    request_id: reqs[2].id,
    bid_id: bids[3].id,
    client_id: clientId,
    provider_id: prov1Id,
    status: 'active',
    confirm_code: '847291',
    confirm_code_exp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();
  if (jErr || !job) { console.error('  ERR', jErr?.message); return; }
  console.log('  job OK — confirm code: 847291');

  // 7. Messages
  console.log('\n7. Creating messages...');
  await s.from('messages').delete().eq('job_id', job.id);
  const { error: mErr } = await s.from('messages').insert([
    { job_id: job.id, sender_id: clientId, content: '\u0623\u0647\u0644\u0627\u064b\u060c \u0645\u062a\u0649 \u062a\u0642\u062f\u0631 \u062a\u062c\u064a\u061f', msg_type: 'text' },
    { job_id: job.id, sender_id: prov1Id,  content: '\u0628\u0643\u0631\u0629 \u0627\u0644\u0635\u0628\u062d \u0627\u0644\u0633\u0627\u0639\u0629 9', msg_type: 'text' },
    { job_id: job.id, sender_id: clientId, content: '\u062a\u0645\u0627\u0645\u060c \u0623\u0646\u0627 \u0645\u0648\u062c\u0648\u062f', msg_type: 'text' },
  ]);
  if (mErr) { console.error('  ERR', mErr.message); return; }
  console.log('  3 messages OK');

  // 8. Portfolio
  console.log('\n8. Creating portfolio items...');
  await s.from('portfolio_items').delete().eq('provider_id', prov1Id);
  const { error: ptErr } = await s.from('portfolio_items').insert([
    {
      provider_id: prov1Id, type: 'single',
      title: '\u0625\u0635\u0644\u0627\u062d \u0633\u062e\u0627\u0646',
      description: '\u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u062b\u0631\u0645\u0648\u0633\u062a\u0627\u062a',
      media_url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600',
    },
    {
      provider_id: prov1Id, type: 'single',
      title: '\u062a\u0645\u062f\u064a\u062f \u0633\u0628\u0627\u0643\u0629 \u062d\u0645\u0627\u0645',
      description: '\u062a\u0645\u062f\u064a\u062f \u0643\u0627\u0645\u0644',
      media_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600',
    },
  ]);
  if (ptErr) { console.error('  ERR portfolio', ptErr.message); }
  else console.log('  2 portfolio items OK');

  console.log('\n=== SEED COMPLETE ===');
  console.log('CLIENT    +96279000001  OTP: 123456');
  console.log('PROVIDER1 +96279000002  OTP: 123456');
  console.log('PROVIDER2 +96279000003  OTP: 123456');
  console.log('Job confirm code: 847291\n');
}

seed().catch(e => { console.error('FATAL:', e); process.exit(1); });
