-- ============================================================
-- Migration 021: Provider Demo Request System
-- ============================================================
-- Purpose: When a new provider registers, schedule one demo
-- request to arrive ~1 hour later. The provider can submit a
-- free bid on it (no credits deducted) to learn the platform.
-- After 48 hours the demo expires and is hidden permanently.
-- ============================================================

-- ─── 1. Demo request templates pool ──────────────────────────

CREATE TABLE IF NOT EXISTS demo_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  city          TEXT        NOT NULL,
  district      TEXT,
  category_slug TEXT        NOT NULL,
  is_urgent     BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed pool: 12 varied, realistic Jordanian service requests
INSERT INTO demo_requests (title, description, city, district, category_slug, is_urgent) VALUES
  ('إصلاح تسريب مياه في المطبخ',
   'الصنبور يسرّب منذ يومين ويتسبب في تلف الخزانة. أحتاج سباك يحضر اليوم ويفحص الوصلات.',
   'عمّان', 'الشميساني', 'plumbing', false),

  ('صيانة مكيف سبليت لا يبرد',
   'المكيف يعمل لكن الهواء دافئ تماماً. آخر صيانة كانت قبل عامين. النوع LG 18000 وحدة.',
   'عمّان', 'الجبيهة', 'ac_repair', false),

  ('دهان غرفة نوم — طابقين',
   'غرفة نوم رئيسية 4×5 متر وغرفة أطفال 3×4 متر. أريد لون فاتح للأولى وألوان مرحة للأطفال.',
   'الزرقاء', 'الجديدة', 'painting', false),

  ('تركيب باب خشبي وتأطيره',
   'تلف الباب الخشبي الداخلي في غرفة الضيوف. أحتاج توريد وتركيب باب جديد بنفس المقاس 90×200.',
   'إربد', 'وسط البلد', 'carpentry', false),

  ('إصلاح عطل كهربائي — انقطاع متكرر',
   'القاطع الرئيسي يتحرك باستمرار. أشك في قصر كهربائي في إحدى الغرف. أحتاج كهربائي ماهر.',
   'عمّان', 'مرج الحمام', 'electrical', false),

  ('تنظيف شقة بعد انتهاء عقد الإيجار',
   'شقة 120 متر مربع — 3 غرف. تحتاج تنظيفاً عميقاً شاملاً للسيراميك والحمامات والمطبخ.',
   'عمّان', 'تلاع العلي', 'cleaning', false),

  ('تصليح ثلاجة — لا تبرد الشاشة العلوية',
   'ثلاجة سامسونج عمرها 4 سنوات. الجزء الأسفل يعمل والعلوي (الفريزر) لا يبرد. أحتاج فني.',
   'العقبة', 'الرويشد', 'appliance_repair', false),

  ('تدريس رياضيات للصف الحادي عشر',
   'ابنتي في الحادي عشر العلمي وتحتاج دروسًا خصوصية في الرياضيات. مرتين أسبوعياً.',
   'عمّان', 'دابوق', 'tutoring', false),

  ('نقل أثاث من شقة لشقة داخل عمّان',
   'نقل محتويات شقة كاملة — صالون، 3 غرف نوم، مطبخ — مع التغليف والتنزيل. الموعد الأسبوع القادم.',
   'عمّان', 'صويلح', 'moving', false),

  ('إصلاح ماء ساخن — سخّان معطل',
   'السخّان الكهربائي لا يسخن. ضغطت على زر الأمان لكن لم يفد. أحتاج فني سريع.',
   'عمّان', 'أبو نصير', 'plumbing', false),

  ('تركيب أرضية باركيه في الصالون',
   'مساحة الصالون 30 متر مربع. الأرضية الحالية سيراميك وأريد تغييرها لباركيه بلون بني فاتح.',
   'إربد', 'الحي الشمالي', 'carpentry', false),

  ('تصميم شعار لمشروع تجاري ناشئ',
   'أحتاج شعار بسيط وعصري لمشروع توصيل طلبات. أريد ألوان زرقاء وبيضاء مع إمكانية تقديم 3 خيارات.',
   'عمّان', 'البنيات', 'design', false)
ON CONFLICT DO NOTHING;

-- ─── 2. Per-provider demo tracking ───────────────────────────

CREATE TABLE IF NOT EXISTS provider_demo_status (
  provider_id          UUID        PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  demo_request_id      UUID        NOT NULL REFERENCES demo_requests(id),
  send_after           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  notification_sent    BOOLEAN     NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  bid_submitted        BOOLEAN     NOT NULL DEFAULT false,
  bid_submitted_at     TIMESTAMPTZ,
  bid_amount           NUMERIC(10, 2),
  bid_note             TEXT,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_status_send
  ON provider_demo_status (send_after)
  WHERE notification_sent = false;

-- ─── 3. RPC: init_provider_demo ──────────────────────────────
-- Called from app after provider row is created.
-- Picks a random demo request template and creates the demo row.

CREATE OR REPLACE FUNCTION init_provider_demo(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demo_id UUID;
BEGIN
  SELECT id INTO v_demo_id
  FROM demo_requests
  ORDER BY random()
  LIMIT 1;

  INSERT INTO provider_demo_status (provider_id, demo_request_id)
  VALUES (p_provider_id, v_demo_id)
  ON CONFLICT (provider_id) DO NOTHING;
END;
$$;

-- ─── 4. RPC: get_provider_demo ───────────────────────────────
-- Returns the demo request for a provider if it is visible
-- (send_after passed, not expired, not yet submitted).
-- Returns NULL if no demo or not yet ready.

CREATE OR REPLACE FUNCTION get_provider_demo(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demo provider_demo_status%ROWTYPE;
  v_req  demo_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_demo
  FROM provider_demo_status
  WHERE provider_id = p_provider_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Already submitted — return submitted state
  IF v_demo.bid_submitted THEN
    RETURN jsonb_build_object(
      'status',     'submitted',
      'bid_amount', v_demo.bid_amount,
      'bid_note',   v_demo.bid_note
    );
  END IF;

  -- Expired without bid
  IF v_demo.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  -- Not ready yet (inside first hour)
  IF v_demo.send_after > now() THEN
    RETURN NULL;
  END IF;

  -- Fetch template
  SELECT * INTO v_req
  FROM demo_requests
  WHERE id = v_demo.demo_request_id;

  RETURN jsonb_build_object(
    'status',     'pending',
    'expires_at', v_demo.expires_at,
    'request', jsonb_build_object(
      'id',            v_req.id,
      'title',         v_req.title,
      'description',   v_req.description,
      'city',          v_req.city,
      'district',      v_req.district,
      'category_slug', v_req.category_slug,
      'is_urgent',     v_req.is_urgent
    )
  );
END;
$$;

-- ─── 5. RPC: submit_demo_bid ─────────────────────────────────
-- Records a demo bid. Does NOT touch bid_credits or the bids table.

CREATE OR REPLACE FUNCTION submit_demo_bid(
  p_provider_id UUID,
  p_amount      NUMERIC,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE provider_demo_status
  SET bid_submitted     = true,
      bid_submitted_at  = now(),
      bid_amount        = p_amount,
      bid_note          = p_note
  WHERE provider_id  = p_provider_id
    AND bid_submitted = false
    AND expires_at    > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── 6. Function: get_pending_demo_notifications ─────────────
-- Called by the Edge Function to get providers who need a push
-- notification sent (send_after has passed, not yet notified).

CREATE OR REPLACE FUNCTION get_pending_demo_notifications()
RETURNS TABLE (
  provider_id UUID,
  token       TEXT,
  full_name   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pds.provider_id,
    pt.token,
    u.full_name
  FROM provider_demo_status pds
  JOIN push_tokens  pt ON pt.user_id = pds.provider_id
  JOIN users        u  ON u.id       = pds.provider_id
  WHERE pds.send_after        <= now()
    AND pds.notification_sent = false
    AND pds.expires_at        > now();
END;
$$;

-- ─── 7. Function: mark_demo_notification_sent ────────────────

CREATE OR REPLACE FUNCTION mark_demo_notification_sent(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE provider_demo_status
  SET notification_sent    = true,
      notification_sent_at = now()
  WHERE provider_id = p_provider_id;
END;
$$;

-- ─── 8. RLS policies ─────────────────────────────────────────

ALTER TABLE demo_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_demo_status ENABLE ROW LEVEL SECURITY;

-- demo_requests: read-only for everyone (no client data)
DROP POLICY IF EXISTS "demo_requests_select" ON demo_requests;
CREATE POLICY "demo_requests_select"
  ON demo_requests FOR SELECT
  USING (true);

-- provider_demo_status: provider can only see their own row
DROP POLICY IF EXISTS "demo_status_own" ON provider_demo_status;
CREATE POLICY "demo_status_own"
  ON provider_demo_status FOR SELECT
  USING (provider_id = auth.uid());

-- Grant execute on RPCs to authenticated users
GRANT EXECUTE ON FUNCTION init_provider_demo(UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION get_provider_demo(UUID)                         TO authenticated;
GRANT EXECUTE ON FUNCTION submit_demo_bid(UUID, NUMERIC, TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_demo_notifications()                TO service_role;
GRANT EXECUTE ON FUNCTION mark_demo_notification_sent(UUID)               TO service_role;
