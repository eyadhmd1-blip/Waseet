-- ─────────────────────────────────────────────────────────────────────────────
-- 014 — Support tickets system
-- ─────────────────────────────────────────────────────────────────────────────

-- Ticket category enum
DO $$ BEGIN
  CREATE TYPE support_category AS ENUM (
    'payment', 'order', 'provider', 'account', 'contract', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ticket priority enum
DO $$ BEGIN
  CREATE TYPE support_priority AS ENUM ('normal', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ticket status enum
DO $$ BEGIN
  CREATE TYPE support_status AS ENUM ('open', 'in_review', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Support tickets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      support_category NOT NULL DEFAULT 'other',
  priority      support_priority NOT NULL DEFAULT 'normal',
  status        support_status   NOT NULL DEFAULT 'open',
  subject       text          NOT NULL,
  -- Assigned admin agent (NULL = unassigned)
  assigned_to   uuid          REFERENCES users(id) ON DELETE SET NULL,
  -- Rating given by user after resolution (1–5)
  rating        smallint      CHECK (rating BETWEEN 1 AND 5),
  rating_note   text,
  opened_at     timestamptz   NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- ── Ticket messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  -- sender_id NULL = system/bot message
  sender_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  is_admin   boolean     NOT NULL DEFAULT false,
  body       text        NOT NULL,
  -- Optional attachment URL
  attachment_url  text,
  attachment_type text,   -- 'image' | 'pdf' | 'video'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Ticket attachments (separate table for multi-file) ─────────────────────
CREATE TABLE IF NOT EXISTS support_attachments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id uuid        REFERENCES support_messages(id) ON DELETE CASCADE,
  url        text        NOT NULL,
  file_type  text        NOT NULL, -- 'image' | 'pdf' | 'video'
  file_name  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── FAQ articles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_faq (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   support_category NOT NULL DEFAULT 'other',
  sort_order int         NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Admin canned responses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_canned_responses (
  id       uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  title    text  NOT NULL,
  body     text  NOT NULL,
  category support_category,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status    ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority  ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket   ON support_messages(ticket_id);

-- ── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_faq           ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_canned_responses ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tickets
CREATE POLICY "user_own_tickets" ON support_tickets
  FOR ALL USING (user_id = auth.uid());

-- Users can only see messages belonging to their tickets
CREATE POLICY "user_ticket_messages" ON support_messages
  FOR ALL USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  );

-- FAQ is public
CREATE POLICY "faq_public_read" ON support_faq
  FOR SELECT USING (is_active = true);

-- ── Seed: default FAQ articles ─────────────────────────────────────────────
INSERT INTO support_faq (question, answer, category, sort_order) VALUES
  ('كيف أقدّم طلباً للخدمة؟',
   'اضغط على زر "طلب جديد" في الشاشة الرئيسية، اختر التصنيف المناسب، أضف وصفاً للعمل وحدد موقعك. ستصلك عروض من المزودين خلال دقائق.',
   'order', 1),
  ('كيف أختار أفضل عرض؟',
   'قارن بين العروض من حيث السعر والتقييم وعدد الأعمال المنجزة. يمكنك أيضاً مراجعة معرض الأعمال لكل مزود قبل الاختيار.',
   'order', 2),
  ('ماذا أفعل إذا لم أكن راضياً عن الخدمة؟',
   'أرسل تذكرة دعم فني من هنا مع وصف المشكلة. فريقنا سيراجع الأمر خلال ٢٤ ساعة.',
   'provider', 3),
  ('هل الدفع آمن؟',
   'نعم، جميع المعاملات المالية مؤمّنة بتشفير SSL. ندعم Visa وMasterCard وApple Pay.',
   'payment', 4),
  ('كيف أصبح مزوداً؟',
   'سجّل حساباً كمزود خدمات، أكمل ملفك الشخصي وأضف تخصصاتك ومدينتك. بعد مراجعة الفريق ستتمكن من تلقي الطلبات.',
   'account', 5),
  ('ما وقت عمل الدعم الفني؟',
   'الدعم عبر التذاكر متاح ٢٤/٧ وسيُجاب عليك خلال ٢-٨ ساعات.',
   'other', 6)
ON CONFLICT DO NOTHING;

-- ── Seed: canned responses ─────────────────────────────────────────────────
INSERT INTO support_canned_responses (title, body, category) VALUES
  ('ردّ استلام التذكرة',
   'شكراً لتواصلك مع فريق وسيط. استلمنا تذكرتك وسيقوم أحد أعضاء فريق الدعم بالرد خلال ٢–٤ ساعات.',
   'other'),
  ('مشكلة الدفع — طلب التحقق',
   'لمراجعة مشكلتك يرجى تزويدنا برقم الطلب وتاريخ الدفع وآخر ٤ أرقام من طريقة الدفع المستخدمة.',
   'payment'),
  ('إغلاق التذكرة بعد الحل',
   'يسعدنا أن مشكلتك تم حلها. إذا واجهت أي استفسار آخر لا تتردد في فتح تذكرة جديدة. تقييمك يساعدنا على تحسين الخدمة!',
   'other')
ON CONFLICT DO NOTHING;
