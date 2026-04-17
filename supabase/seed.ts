// ============================================================
// WASEET — Test Data Seed Script
// Run with: npx ts-node seed.ts  OR  node --require ts-node/register seed.ts
//
// Creates:
//   - 1 test client  : phone +96279000001 / OTP 123456
//   - 2 test providers: phone +96279000002, +96279000003 / OTP 123456
//   - Requests, bids, a live job, messages, portfolio items
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://bkbjsstxhvdnqcmpuulf.supabase.co';
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYmpzc3R4aHZkbnFjbXB1dWxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyNjc4NywiZXhwIjoyMDkxODAyNzg3fQ.JfE_DLW4jB6_E1MjaOFCSj56n6Tr0jhfQXwFqhKd1V0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────

function log(msg: string) { console.log(`  ${msg}`); }
function ok(msg: string)  { console.log(`  ✓ ${msg}`); }
function fail(msg: string, err: unknown) {
  console.error(`  ✗ ${msg}`, err);
}

async function createAuthUser(phone: string, name: string): Promise<string | null> {
  // Delete existing user with this phone first (idempotent re-runs)
  const { data: existing } = await supabase.auth.admin.listUsers();
  const old = existing?.users?.find(u => u.phone === phone);
  if (old) {
    await supabase.auth.admin.deleteUser(old.id);
    log(`Removed old auth user ${phone}`);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: true,   // mark phone as verified — no OTP needed from admin API
    user_metadata: { full_name: name },
  });

  if (error || !data?.user) {
    fail(`createAuthUser(${phone})`, error);
    return null;
  }
  return data.user.id;
}

// ─── Main ─────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  Waseet seed starting…\n');

  // ── 1. Create auth users ──────────────────────────────────
  console.log('① Creating auth users…');

  const clientId    = await createAuthUser('+96279000001', 'أحمد العميل');
  const provider1Id = await createAuthUser('+96279000002', 'محمد المزود');
  const provider2Id = await createAuthUser('+96279000003', 'خالد الكهربائي');

  if (!clientId || !provider1Id || !provider2Id) {
    console.error('\n❌  Failed to create auth users. Stopping.\n');
    process.exit(1);
  }
  ok(`Client     → ${clientId}`);
  ok(`Provider 1 → ${provider1Id}`);
  ok(`Provider 2 → ${provider2Id}`);

  // ── 2. Public users table ─────────────────────────────────
  console.log('\n② Inserting public users…');

  const { error: usersErr } = await supabase.from('users').upsert([
    {
      id: clientId,
      role: 'client',
      full_name: 'أحمد العميل',
      phone: '+96279000001',
      phone_verified: true,
      city: 'عمان',
    },
    {
      id: provider1Id,
      role: 'provider',
      full_name: 'محمد السباك',
      phone: '+96279000002',
      phone_verified: true,
      city: 'عمان',
    },
    {
      id: provider2Id,
      role: 'provider',
      full_name: 'خالد الكهربائي',
      phone: '+96279000003',
      phone_verified: true,
      city: 'عمان',
    },
  ], { onConflict: 'id' });

  if (usersErr) { fail('users upsert', usersErr); process.exit(1); }
  ok('3 users inserted');

  // ── 3. Providers table ────────────────────────────────────
  console.log('\n③ Inserting provider profiles…');

  const { error: provErr } = await supabase.from('providers').upsert([
    {
      id: provider1Id,
      bio: 'سباك محترف بخبرة 10 سنوات في عمان والزرقاء. متاح على مدار الساعة للطوارئ.',
      categories: ['plumbing', 'cleaning'],
      score: 4.7,
      reputation_tier: 'trusted',
      lifetime_jobs: 42,
      is_subscribed: true,
      subscription_tier: 'pro',
      subscription_ends: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      badge_verified: true,
      bid_credits: 45,
      trial_used: true,
    },
    {
      id: provider2Id,
      bio: 'كهربائي معتمد. تمديدات كهربائية، لوحات توزيع، إنارة.',
      categories: ['electrical'],
      score: 4.2,
      reputation_tier: 'rising',
      lifetime_jobs: 18,
      is_subscribed: true,
      subscription_tier: 'basic',
      subscription_ends: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      badge_verified: false,
      bid_credits: 14,
      trial_used: true,
    },
  ], { onConflict: 'id' });

  if (provErr) { fail('providers upsert', provErr); process.exit(1); }
  ok('2 provider profiles inserted');

  // ── 4. Requests ───────────────────────────────────────────
  console.log('\n④ Creating requests…');

  // Delete old seed requests to keep things clean
  await supabase.from('requests').delete().eq('client_id', clientId);

  const { data: reqs, error: reqErr } = await supabase.from('requests').insert([
    {
      client_id: clientId,
      category_slug: 'plumbing',
      title: 'إصلاح تسرب مياه في الحمام',
      description: 'يوجد تسرب تحت المغسلة منذ يومين، المياه تتجمع على الأرض.',
      city: 'عمان',
      district: 'الرابية',
      status: 'open',
      ai_suggested_price_min: 25,
      ai_suggested_price_max: 60,
    },
    {
      client_id: clientId,
      category_slug: 'electrical',
      title: 'تركيب لوحة كهربائية جديدة',
      description: 'أريد تركيب لوحة توزيع كهربائي 12 خط في الشقة الجديدة.',
      city: 'عمان',
      district: 'الجبيهة',
      status: 'open',
      ai_suggested_price_min: 80,
      ai_suggested_price_max: 150,
    },
    {
      client_id: clientId,
      category_slug: 'plumbing',
      title: 'تمديد خط مياه للمطبخ',
      description: 'أحتاج تمديد خط مياه بارد وساخن لغسالة الصحون.',
      city: 'عمان',
      district: 'مرج الحمام',
      status: 'in_progress',
      ai_suggested_price_min: 40,
      ai_suggested_price_max: 90,
    },
  ]).select();

  if (reqErr || !reqs) { fail('requests insert', reqErr); process.exit(1); }
  ok(`${reqs.length} requests created`);

  const [openReq1, openReq2, inProgressReq] = reqs;

  // ── 5. Bids ───────────────────────────────────────────────
  console.log('\n⑤ Creating bids…');

  await supabase.from('bids').delete().in('request_id', reqs.map(r => r.id));

  const { data: bids, error: bidErr } = await supabase.from('bids').insert([
    // Bid on open request 1
    {
      request_id: openReq1.id,
      provider_id: provider1Id,
      amount: 35,
      note: 'أقدر أجي خلال ساعتين. عندي كل الأدوات اللازمة.',
      status: 'pending',
      credit_cost: 1,
    },
    {
      request_id: openReq1.id,
      provider_id: provider2Id,
      amount: 45,
      note: 'أعمل بضمان كامل على الإصلاح.',
      status: 'pending',
      credit_cost: 1,
    },
    // Bid on open request 2
    {
      request_id: openReq2.id,
      provider_id: provider2Id,
      amount: 120,
      note: 'لدي خبرة في تركيب لوحات Schneider وABB.',
      status: 'pending',
      credit_cost: 1,
    },
    // Accepted bid on in-progress request
    {
      request_id: inProgressReq.id,
      provider_id: provider1Id,
      amount: 55,
      note: 'جاهز للتنفيذ غداً الصباح.',
      status: 'accepted',
      credit_cost: 1,
    },
  ]).select();

  if (bidErr || !bids) { fail('bids insert', bidErr); process.exit(1); }
  ok(`${bids.length} bids created`);

  const acceptedBid = bids[3];

  // ── 6. Job (active) ───────────────────────────────────────
  console.log('\n⑥ Creating active job…');

  await supabase.from('jobs').delete().eq('request_id', inProgressReq.id);

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    request_id:  inProgressReq.id,
    bid_id:      acceptedBid.id,
    client_id:   clientId,
    provider_id: provider1Id,
    status:      'active',
    confirm_code: '847291',
    confirm_code_exp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();

  if (jobErr || !job) { fail('job insert', jobErr); process.exit(1); }
  ok(`Job created → confirm code: 847291`);

  // ── 7. Chat messages ──────────────────────────────────────
  console.log('\n⑦ Creating chat messages…');

  await supabase.from('messages').delete().eq('job_id', job.id);

  const { error: msgErr } = await supabase.from('messages').insert([
    {
      job_id: job.id,
      sender_id: clientId,
      content: 'أهلاً، متى تقدر تجي؟',
      msg_type: 'text',
    },
    {
      job_id: job.id,
      sender_id: provider1Id,
      content: 'بكرة الصبح الساعة 9، إن شاء الله',
      msg_type: 'text',
    },
    {
      job_id: job.id,
      sender_id: clientId,
      content: 'تمام، أنا موجود',
      msg_type: 'text',
    },
  ]);

  if (msgErr) { fail('messages insert', msgErr); }
  else ok('3 chat messages created');

  // ── 8. Portfolio items ────────────────────────────────────
  console.log('\n⑧ Creating portfolio items…');

  await supabase.from('portfolio_items').delete().eq('provider_id', provider1Id);

  const { error: portErr } = await supabase.from('portfolio_items').insert([
    {
      provider_id: provider1Id,
      type: 'single',
      title: 'إصلاح سخان كهربائي',
      description: 'استبدال ثرموستات وعنصر تسخين في سخان 80 لتر',
      media_url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600',
    },
    {
      provider_id: provider1Id,
      type: 'single',
      title: 'تمديد سباكة حمام كامل',
      description: 'تمديد جديد كامل لحمام في شقة 3 غرف',
      media_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600',
    },
  ]);

  if (portErr) { fail('portfolio insert', portErr); }
  else ok('2 portfolio items created');

  // ─────────────────────────────────────────────────────────
  console.log('\n✅  Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Test accounts (OTP: 123456 for all)');
  console.log('  CLIENT   → +962 79 000 0001');
  console.log('  PROVIDER → +962 79 000 0002  (pro, 45 credits)');
  console.log('  PROVIDER → +962 79 000 0003  (basic, 14 credits)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Active job confirm code: 847291');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seed().catch(err => {
  console.error('\n❌  Unexpected error:', err);
  process.exit(1);
});
