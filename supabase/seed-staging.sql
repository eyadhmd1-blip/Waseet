-- ============================================================
-- Waseet — Staging Seed Data
-- Deterministic test fixtures for QA / regression testing.
-- ============================================================
-- IMPORTANT:
--   Run AFTER all migrations (001–019) have been applied.
--   Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
--   All test users use phone numbers in the +9621000XXXX range (test numbers).
--   All UUIDs are fixed for reproducible test scenarios.
-- ============================================================

BEGIN;

-- ============================================================
-- TEST USERS
-- ============================================================

-- Client: Ahmad (id: c1000000-0000-0000-0000-000000000001)
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'client', 'أحمد الزيد', '+962100000001', true, 'عمّان',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (id) DO NOTHING;

-- Client: Sara (id: c2000000-0000-0000-0000-000000000002)
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'c2000000-0000-0000-0000-000000000002',
  'client', 'سارة الخالد', '+962100000002', true, 'الزرقاء',
  NOW() - INTERVAL '25 days'
)
ON CONFLICT (id) DO NOTHING;

-- Provider: Khalid — trial subscription, 8 credits left
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'p1000000-0000-0000-0000-000000000001',
  'provider', 'خالد المحمد', '+962100000010', true, 'عمّان',
  NOW() - INTERVAL '20 days'
)
ON CONFLICT (id) DO NOTHING;

-- Provider: Fatima — basic subscription (20 credits), trusted tier
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'p2000000-0000-0000-0000-000000000002',
  'provider', 'فاطمة العلي', '+962100000011', true, 'عمّان',
  NOW() - INTERVAL '60 days'
)
ON CONFLICT (id) DO NOTHING;

-- Provider: Omar — premium subscription (unlimited), expert tier, high win_discount
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'p3000000-0000-0000-0000-000000000003',
  'provider', 'عمر الحسن', '+962100000012', true, 'إربد',
  NOW() - INTERVAL '90 days'
)
ON CONFLICT (id) DO NOTHING;

-- Provider: Rania — zero credits (for testing errNoCredits)
INSERT INTO users (id, role, full_name, phone, phone_verified, city, created_at)
VALUES (
  'p4000000-0000-0000-0000-000000000004',
  'provider', 'رانيا النعيم', '+962100000013', true, 'عمّان',
  NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PROVIDER PROFILES
-- ============================================================

-- Khalid: trial, 8 credits remaining, new tier
INSERT INTO providers (
  id, categories, score, reputation_tier, lifetime_jobs,
  is_subscribed, subscription_tier, subscription_ends,
  bid_credits, trial_used, bid_rejection_rate, win_discount_pct,
  badge_verified, loyalty_discount, free_months_earned
)
VALUES (
  'p1000000-0000-0000-0000-000000000001',
  ARRAY['electrical','plumbing'],
  0.00, 'new', 0,
  true, 'trial', NOW() + INTERVAL '28 days',
  8, true, 0.000, 0,
  false, 0, 0
)
ON CONFLICT (id) DO NOTHING;

-- Fatima: basic (20 credits), trusted tier, 2 jobs done, win_discount=6
INSERT INTO providers (
  id, categories, score, reputation_tier, lifetime_jobs,
  is_subscribed, subscription_tier, subscription_ends,
  bid_credits, trial_used, bid_rejection_rate, win_discount_pct,
  badge_verified, loyalty_discount, free_months_earned
)
VALUES (
  'p2000000-0000-0000-0000-000000000002',
  ARRAY['cleaning','painting'],
  4.50, 'trusted', 26,
  true, 'basic', NOW() + INTERVAL '25 days',
  17, true, 0.100, 6,
  true, 0, 0
)
ON CONFLICT (id) DO NOTHING;

-- Omar: premium (unlimited, bid_credits=0), expert tier, 55 jobs, win_discount=15
INSERT INTO providers (
  id, categories, score, reputation_tier, lifetime_jobs,
  is_subscribed, subscription_tier, subscription_ends,
  bid_credits, trial_used, bid_rejection_rate, win_discount_pct,
  badge_verified, loyalty_discount, free_months_earned
)
VALUES (
  'p3000000-0000-0000-0000-000000000003',
  ARRAY['electrical','ac_repair','appliance_repair'],
  4.80, 'expert', 55,
  true, 'premium', NOW() + INTERVAL '22 days',
  0, true, 0.050, 15,
  true, 10, 1
)
ON CONFLICT (id) DO NOTHING;

-- Rania: basic but 0 credits (edge case: exhausted)
INSERT INTO providers (
  id, categories, score, reputation_tier, lifetime_jobs,
  is_subscribed, subscription_tier, subscription_ends,
  bid_credits, trial_used, bid_rejection_rate, win_discount_pct,
  badge_verified, loyalty_discount, free_months_earned
)
VALUES (
  'p4000000-0000-0000-0000-000000000004',
  ARRAY['carpentry','painting'],
  0.00, 'new', 0,
  true, 'basic', NOW() + INTERVAL '15 days',
  0, true, 0.000, 0,
  false, 0, 0
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SERVICE REQUESTS (open)
-- ============================================================

-- Normal request by Ahmad (electrical)
INSERT INTO requests (
  id, client_id, category_slug, title, description, city, district,
  image_urls, status, views_count, created_at
)
VALUES (
  'r1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'electrical',
  'إصلاح لوحة كهربائية',
  'تحتاج لوحة الكهرباء في المنزل إلى صيانة شاملة وتغيير بعض القواطع',
  'عمّان', 'الرابية',
  ARRAY[]::text[], 'open', 5,
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Normal request by Ahmad (plumbing)
INSERT INTO requests (
  id, client_id, category_slug, title, description, city,
  image_urls, status, views_count, created_at
)
VALUES (
  'r2000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000001',
  'plumbing',
  'تسريب مياه في الحمام',
  'يوجد تسريب مياه في أنابيب الحمام يحتاج إلى معالجة عاجلة',
  'عمّان',
  ARRAY[]::text[], 'open', 2,
  NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO NOTHING;

-- Urgent request by Sara (cleaning)
INSERT INTO requests (
  id, client_id, category_slug, title, description, city,
  image_urls, status, views_count, is_urgent, urgent_premium_pct,
  urgent_expires_at, created_at
)
VALUES (
  'r3000000-0000-0000-0000-000000000003',
  'c2000000-0000-0000-0000-000000000002',
  'cleaning',
  'تنظيف منزل عاجل',
  'أحتاج تنظيف المنزل قبل مناسبة في غضون 3 ساعات',
  'الزرقاء',
  ARRAY[]::text[], 'open', 8, true, 25,
  NOW() + INTERVAL '3 hours',
  NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BIDS (test states)
-- ============================================================

-- Fatima bid on Ahmad's electrical request (pending)
INSERT INTO bids (
  id, request_id, provider_id, amount, currency, note, status, credit_cost, created_at
)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'r1000000-0000-0000-0000-000000000001',
  'p2000000-0000-0000-0000-000000000002',
  25.00, 'JOD',
  'لديّ خبرة 5 سنوات في كهرباء المنازل وأستطيع الحضور اليوم',
  'pending', 1,
  NOW() - INTERVAL '90 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Omar bid on Ahmad's electrical request (pending)
INSERT INTO bids (
  id, request_id, provider_id, amount, currency, note, status, credit_cost, created_at
)
VALUES (
  'b2000000-0000-0000-0000-000000000002',
  'r1000000-0000-0000-0000-000000000001',
  'p3000000-0000-0000-0000-000000000003',
  30.00, 'JOD',
  'مزود موثّق بخبرة 10 سنوات، ضمان على الأعمال',
  'pending', 1,
  NOW() - INTERVAL '45 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RECURRING CONTRACT (open for bidding)
-- ============================================================

INSERT INTO recurring_contracts (
  id, client_id, category_slug, title, description, city,
  frequency, preferred_day, preferred_time_window,
  duration_months, currency, status, created_at, updated_at,
  completed_visits
)
VALUES (
  'rc100000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000002',
  'cleaning',
  'تنظيف أسبوعي للمنزل',
  'تنظيف شامل للمنزل أسبوعياً مدة 3 أشهر',
  'الزرقاء',
  'weekly', 4, 'morning',
  3, 'JOD', 'bidding',
  NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
  0
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUPPORT TICKET (for support thread testing)
-- ============================================================

INSERT INTO support_tickets (
  id, user_id, category, priority, status, subject, opened_at
)
VALUES (
  'st100000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'technical', 'medium', 'open',
  'لا تظهر لي إشعارات المزايدات',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_messages (
  id, ticket_id, sender_id, is_admin, body, created_at
)
VALUES (
  'sm100000-0000-0000-0000-000000000001',
  'st100000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  false,
  'مرحباً، لا تصلني إشعارات عندما يتقدم مزود لطلبي. هل هناك مشكلة؟',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after seeding to confirm data integrity
-- ============================================================

-- DO $$
-- DECLARE
--   v_users INT;
--   v_providers INT;
--   v_requests INT;
--   v_bids INT;
-- BEGIN
--   SELECT COUNT(*) INTO v_users    FROM users    WHERE phone LIKE '+96210000%';
--   SELECT COUNT(*) INTO v_providers FROM providers WHERE id LIKE 'p%';
--   SELECT COUNT(*) INTO v_requests FROM requests  WHERE id LIKE 'r%';
--   SELECT COUNT(*) INTO v_bids     FROM bids      WHERE id LIKE 'b%';
--
--   RAISE NOTICE 'Seed verification: users=%, providers=%, requests=%, bids=%',
--     v_users, v_providers, v_requests, v_bids;
--   ASSERT v_users    >= 6, 'Expected >= 6 test users';
--   ASSERT v_providers >= 4, 'Expected >= 4 test providers';
--   ASSERT v_requests  >= 3, 'Expected >= 3 test requests';
--   ASSERT v_bids      >= 2, 'Expected >= 2 test bids';
-- END $$;

COMMIT;

-- Quick verification query (run manually):
SELECT
  (SELECT COUNT(*) FROM users WHERE phone LIKE '+96210000%')     AS test_users,
  (SELECT COUNT(*) FROM providers WHERE bid_credits IS NOT NULL) AS providers_with_credits,
  (SELECT COUNT(*) FROM requests WHERE status = 'open')          AS open_requests,
  (SELECT COUNT(*) FROM bids WHERE status = 'pending')           AS pending_bids,
  (SELECT COUNT(*) FROM recurring_contracts)                     AS contracts,
  (SELECT COUNT(*) FROM support_tickets)                         AS support_tickets;
