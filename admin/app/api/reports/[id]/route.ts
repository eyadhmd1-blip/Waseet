import { supabaseAdmin } from '../../../lib/supabase';
import { NextRequest } from 'next/server';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** UTF-8 BOM + CSV — Arabic shows correctly in Excel without import wizard */
function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: unknown): string => {
    if (v == null) return '';
    // Always quote strings so Excel never misinterprets phone numbers (00962...) as numeric
    if (typeof v === 'number') return String(v);
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const lines = [headers, ...rows].map(r => r.map(esc).join(','));
  return '﻿' + lines.join('\r\n');
}

function fmtDT(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleString('ar-JO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtD(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ar-JO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function subLbl(t: string | null | undefined): string {
  return ({ basic: 'أساسية', pro: 'محترف', premium: 'نخبة' } as Record<string, string>)[t ?? ''] ?? (t ?? '');
}

function tierLbl(t: string | null | undefined): string {
  return ({ new: 'جديد', rising: 'صاعد', trusted: 'موثوق', expert: 'خبير', elite: 'نخبة' } as Record<string, string>)[t ?? ''] ?? (t ?? '');
}

function cancelLbl(r: string | null | undefined): string {
  return ({ by_client: 'بواسطة العميل', urgent_expired: 'انتهاء طارئ', by_admin: 'بواسطة الإدارة' } as Record<string, string>)[r ?? ''] ?? (r ?? '—');
}

function statusLbl(s: string | null | undefined): string {
  return ({ open: 'مفتوح', in_progress: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغي', expired: 'منتهي' } as Record<string, string>)[s ?? ''] ?? (s ?? '');
}

function reportTypeLbl(t: string | null | undefined): string {
  return ({ no_show: 'غياب', fake_bid: 'عرض وهمي', abusive: 'إساءة', spam: 'سبام', other: 'أخرى' } as Record<string, string>)[t ?? ''] ?? (t ?? '');
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today   = new Date().toISOString().split('T')[0];
  const now     = new Date().toISOString();
  const ago7d   = new Date(Date.now() -  7 * 86_400_000).toISOString();
  const ago30d  = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const ago90d  = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const ago24h  = new Date(Date.now() -      86_400_000).toISOString();
  const in7d    = new Date(Date.now() +  7 * 86_400_000).toISOString();

  let csv      = '';
  let filename = `waseet-${id}-${today}.csv`;

  try {
    let H: string[]                                        = [];
    let R: (string | number | null | undefined)[][] = [];

    switch (id) {

      // ════════════════════════════════════════════════════════════════════════
      // GROUP A — FINANCIAL
      // ════════════════════════════════════════════════════════════════════════

      case 'a01': { // الاشتراكات النشطة
        const { data } = await supabaseAdmin
          .from('providers')
          .select('subscription_tier, subscription_ends, lifetime_jobs, score, user:users!providers_id_fkey(full_name, phone, city)')
          .eq('is_subscribed', true)
          .order('subscription_ends', { ascending: true });
        H = ['الاسم', 'الهاتف', 'المدينة', 'الخطة', 'تاريخ الانتهاء', 'وظائف منجزة', 'التقييم'];
        R = (data ?? []).map((p: any) => [
          p.user?.full_name, p.user?.phone, p.user?.city,
          subLbl(p.subscription_tier), fmtD(p.subscription_ends),
          p.lifetime_jobs, p.score,
        ]);
        filename = `a01-active-subs-${today}.csv`;
        break;
      }

      case 'a02': { // الاشتراكات المنتهية
        const { data } = await supabaseAdmin
          .from('providers')
          .select('subscription_tier, subscription_ends, lifetime_jobs, score, user:users!providers_id_fkey(full_name, phone, city)')
          .eq('is_subscribed', false)
          .not('subscription_ends', 'is', null)
          .lt('subscription_ends', now)
          .order('subscription_ends', { ascending: false });
        H = ['الاسم', 'الهاتف', 'المدينة', 'آخر خطة', 'انتهت في', 'وظائف منجزة', 'التقييم'];
        R = (data ?? []).map((p: any) => [
          p.user?.full_name, p.user?.phone, p.user?.city,
          subLbl(p.subscription_tier), fmtD(p.subscription_ends),
          p.lifetime_jobs, p.score,
        ]);
        filename = `a02-expired-subs-${today}.csv`;
        break;
      }

      case 'a03': { // تنتهي خلال 7 أيام
        const { data } = await supabaseAdmin
          .from('providers')
          .select('subscription_tier, subscription_ends, lifetime_jobs, score, user:users!providers_id_fkey(full_name, phone, city)')
          .eq('is_subscribed', true)
          .gte('subscription_ends', now)
          .lte('subscription_ends', in7d)
          .order('subscription_ends', { ascending: true });
        H = ['الاسم', 'الهاتف', 'المدينة', 'الخطة', 'تاريخ الانتهاء', 'وظائف منجزة', 'التقييم'];
        R = (data ?? []).map((p: any) => [
          p.user?.full_name, p.user?.phone, p.user?.city,
          subLbl(p.subscription_tier), fmtD(p.subscription_ends),
          p.lifetime_jobs, p.score,
        ]);
        filename = `a03-expiring-soon-${today}.csv`;
        break;
      }

      case 'a04': { // تاريخ المدفوعات
        const { data } = await supabaseAdmin
          .from('manual_payments')
          .select(`
            tier, period_months, amount_jod, payment_method, payment_ref, notes, created_at,
            provider:providers!manual_payments_provider_id_fkey(
              user:users!providers_id_fkey(full_name, phone, city)
            )
          `)
          .order('created_at', { ascending: false });
        H = ['الاسم', 'الهاتف', 'المدينة', 'الخطة', 'أشهر', 'المبلغ (دينار)', 'طريقة الدفع', 'مرجع الدفع', 'ملاحظات', 'التاريخ'];
        R = (data ?? []).map((m: any) => [
          (m.provider as any)?.user?.full_name,
          (m.provider as any)?.user?.phone,
          (m.provider as any)?.user?.city,
          subLbl(m.tier), m.period_months, m.amount_jod,
          m.payment_method, m.payment_ref, m.notes ?? '', fmtDT(m.created_at),
        ]);
        filename = `a04-payment-history-${today}.csv`;
        break;
      }

      case 'a05': { // الإيراد الشهري
        const { data } = await supabaseAdmin
          .from('manual_payments')
          .select('amount_jod, created_at')
          .order('created_at', { ascending: true });
        const byMonth = new Map<string, { rev: number; count: number }>();
        for (const m of (data ?? [])) {
          const key = new Date(m.created_at).toLocaleDateString('ar-JO', { year: 'numeric', month: 'long' });
          const v   = byMonth.get(key) ?? { rev: 0, count: 0 };
          v.rev   += Number(m.amount_jod);
          v.count += 1;
          byMonth.set(key, v);
        }
        H = ['الشهر', 'الإيراد (دينار)', 'عدد المدفوعات'];
        R = Array.from(byMonth.entries()).map(([month, v]) => [
          month, v.rev.toFixed(3), v.count,
        ]);
        filename = `a05-monthly-revenue-${today}.csv`;
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GROUP B — OPERATIONS
      // ════════════════════════════════════════════════════════════════════════

      case 'b01': { // الطلبات حسب الحالة (30 يوم)
        const { data } = await supabaseAdmin
          .from('requests')
          .select(`
            id, title, city, category_slug, status, cancelled_reason, created_at,
            client:users!requests_client_id_fkey(full_name, phone)
          `)
          .gte('created_at', ago30d)
          .order('created_at', { ascending: false });
        H = ['رقم الطلب', 'العنوان', 'المدينة', 'الفئة', 'الحالة', 'سبب الإلغاء', 'العميل', 'هاتف العميل', 'التاريخ'];
        R = (data ?? []).map((r: any) => [
          r.id.slice(-8).toUpperCase(), r.title, r.city, r.category_slug,
          statusLbl(r.status), cancelLbl(r.cancelled_reason),
          (r.client as any)?.full_name, (r.client as any)?.phone,
          fmtDT(r.created_at),
        ]);
        filename = `b01-requests-status-${today}.csv`;
        break;
      }

      case 'b02': { // الطلبات حسب المدينة والفئة
        const { data } = await supabaseAdmin
          .from('requests')
          .select('city, category_slug, status')
          .gte('created_at', ago30d);
        type Key = string;
        const tally = new Map<Key, { total: number; open: number; inprog: number; done: number; cancelled: number }>();
        for (const r of (data ?? [])) {
          const k = `${r.city}||${r.category_slug}`;
          const v = tally.get(k) ?? { total: 0, open: 0, inprog: 0, done: 0, cancelled: 0 };
          v.total++;
          if (r.status === 'open')        v.open++;
          if (r.status === 'in_progress') v.inprog++;
          if (r.status === 'completed')   v.done++;
          if (r.status === 'cancelled')   v.cancelled++;
          tally.set(k, v);
        }
        H = ['المدينة', 'الفئة', 'الإجمالي', 'مفتوح', 'جارٍ', 'مكتمل', 'ملغي'];
        R = Array.from(tally.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([k, v]) => {
            const [city, cat] = k.split('||');
            return [city, cat, v.total, v.open, v.inprog, v.done, v.cancelled];
          });
        filename = `b02-requests-city-category-${today}.csv`;
        break;
      }

      case 'b03': { // طلبات بلا عروض +24 ساعة
        const { data: reqs } = await supabaseAdmin
          .from('requests')
          .select(`
            id, title, city, category_slug, created_at,
            client:users!requests_client_id_fkey(full_name, phone)
          `)
          .eq('status', 'open')
          .lt('created_at', ago24h)
          .order('created_at', { ascending: true });
        if (!reqs?.length) {
          csv = toCsv(['الرسالة'], [['لا توجد طلبات مفتوحة بلا عروض تجاوزت 24 ساعة']]);
          filename = `b03-no-bids-${today}.csv`;
          break;
        }
        const ids = reqs.map(r => r.id);
        const { data: bids } = await supabaseAdmin
          .from('bids')
          .select('request_id')
          .in('request_id', ids);
        const hasBid = new Set((bids ?? []).map(b => b.request_id));
        const noBid  = reqs.filter(r => !hasBid.has(r.id));
        H = ['رقم الطلب', 'العنوان', 'المدينة', 'الفئة', 'العميل', 'الهاتف', 'نُشر في', 'ساعات الانتظار'];
        R = noBid.map((r: any) => [
          r.id.slice(-8).toUpperCase(), r.title, r.city, r.category_slug,
          (r.client as any)?.full_name, (r.client as any)?.phone,
          fmtDT(r.created_at),
          Math.round((Date.now() - new Date(r.created_at).getTime()) / 3_600_000),
        ]);
        filename = `b03-no-bids-${today}.csv`;
        break;
      }

      case 'b04': { // معدل التحويل الكامل
        const { data } = await supabaseAdmin
          .from('requests')
          .select('status')
          .gte('created_at', ago30d);
        const all       = (data ?? []).length;
        // "غادر مفتوح" = كل طلب تجاوز مرحلة open (بعض الملغيات قد لا تكون وصلها عروض — تقريبي)
        const leftOpen  = (data ?? []).filter((r: any) => r.status !== 'open').length;
        const inprog    = (data ?? []).filter((r: any) => r.status === 'in_progress').length;
        const done      = (data ?? []).filter((r: any) => r.status === 'completed').length;
        const cancelled = (data ?? []).filter((r: any) => r.status === 'cancelled').length;
        const pct       = (n: number) => all > 0 ? `${Math.round((n / all) * 100)}%` : '—';
        H = ['المرحلة', 'العدد', 'النسبة من الإجمالي', 'ملاحظة'];
        R = [
          ['طلبات مستلمة (30 يوم)', all,      '100%',           ''],
          ['غادر مرحلة مفتوح',      leftOpen, pct(leftOpen),    'تقريبي — يشمل ملغيات قبل أي عرض'],
          ['قيد التنفيذ',           inprog,   pct(inprog),      ''],
          ['مكتملة',                done,     pct(done),        ''],
          ['ملغاة',                 cancelled,pct(cancelled),   ''],
        ];
        filename = `b04-conversion-funnel-${today}.csv`;
        break;
      }

      case 'b05': { // وقت الاستجابة للعرض
        const { data: reqs } = await supabaseAdmin
          .from('requests')
          .select('id, title, city, category_slug, created_at, status')
          .gte('created_at', ago30d);
        const reqIds = (reqs ?? []).map(r => r.id);
        const { data: bids } = reqIds.length
          ? await supabaseAdmin.from('bids').select('request_id, created_at').in('request_id', reqIds).order('created_at', { ascending: true })
          : { data: [] };
        const firstBid = new Map<string, string>();
        for (const b of (bids ?? [])) {
          if (!firstBid.has(b.request_id)) firstBid.set(b.request_id, b.created_at);
        }
        H = ['رقم الطلب', 'العنوان', 'المدينة', 'الفئة', 'وقت النشر', 'أول عرض', 'دقائق حتى أول عرض', 'الحالة'];
        R = (reqs ?? []).map((r: any) => {
          const fb  = firstBid.get(r.id);
          const min = fb ? Math.round((new Date(fb).getTime() - new Date(r.created_at).getTime()) / 60_000) : null;
          return [
            r.id.slice(-8).toUpperCase(), r.title, r.city, r.category_slug,
            fmtDT(r.created_at), fb ? fmtDT(fb) : 'لا يوجد',
            min ?? 'لا يوجد', statusLbl(r.status),
          ];
        });
        filename = `b05-response-time-${today}.csv`;
        break;
      }

      case 'b06': { // وقت إكمال الوظائف
        const { data } = await supabaseAdmin
          .from('jobs')
          .select(`
            created_at, confirmed_at, client_rating,
            request:requests!jobs_request_id_fkey(title, category_slug, city),
            provider:providers!jobs_provider_id_fkey(user:users!providers_id_fkey(full_name)),
            client:users!jobs_client_id_fkey(full_name)
          `)
          .eq('confirmed_by_client', true)
          .not('confirmed_at', 'is', null)
          .gte('confirmed_at', ago30d);
        H = ['الطلب', 'المدينة', 'الفئة', 'مقدم الخدمة', 'العميل', 'بدأ في', 'أُكمل في', 'ساعات الإكمال', 'تقييم العميل'];
        R = (data ?? []).map((j: any) => {
          const hours = j.confirmed_at
            ? +(((new Date(j.confirmed_at).getTime() - new Date(j.created_at).getTime()) / 3_600_000).toFixed(1))
            : '';
          return [
            (j.request as any)?.title, (j.request as any)?.city, (j.request as any)?.category_slug,
            (j.provider as any)?.user?.full_name, j.client?.full_name,
            fmtDT(j.created_at), fmtDT(j.confirmed_at), hours, j.client_rating ?? '',
          ];
        });
        filename = `b06-completion-time-${today}.csv`;
        break;
      }

      case 'b07': { // فجوة العرض والطلب
        const [{ data: reqs }, { data: provs }] = await Promise.all([
          supabaseAdmin.from('requests').select('city, category_slug').gte('created_at', ago30d),
          supabaseAdmin.from('providers').select('categories, user:users!providers_id_fkey(city)').eq('is_subscribed', true),
        ]);
        const demand = new Map<string, number>();
        for (const r of (reqs ?? [])) {
          const k = `${r.city}||${r.category_slug}`;
          demand.set(k, (demand.get(k) ?? 0) + 1);
        }
        const supply = new Map<string, number>();
        for (const p of (provs ?? [])) {
          const city = (p.user as any)?.city;
          if (!city) continue;
          for (const cat of (p.categories ?? [])) {
            const k = `${city}||${cat}`;
            supply.set(k, (supply.get(k) ?? 0) + 1);
          }
        }
        const all = new Set([...demand.keys(), ...supply.keys()]);
        H = ['المدينة', 'الفئة', 'الطلب (آخر 30 يوم)', 'المقدمون المتاحون', 'الفجوة'];
        R = Array.from(all)
          .map(k => {
            const [city, cat] = k.split('||');
            const d = demand.get(k) ?? 0, s = supply.get(k) ?? 0;
            return [city, cat, d, s, d - s];
          })
          .sort((a: any, b: any) => Number(b[4]) - Number(a[4]));
        filename = `b07-supply-demand-gap-${today}.csv`;
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GROUP C — PROVIDERS
      // ════════════════════════════════════════════════════════════════════════

      case 'c01': { // أداء المقدمين
        const [{ data: provs }, { data: allBids }] = await Promise.all([
          supabaseAdmin
            .from('providers')
            .select('id, subscription_tier, is_subscribed, is_active, score, lifetime_jobs, flag_count, reputation_tier, user:users!providers_id_fkey(full_name, phone, city)')
            .order('lifetime_jobs', { ascending: false }),
          supabaseAdmin.from('bids').select('provider_id, status').limit(100_000),
        ]);
        const totalB   = new Map<string, number>();
        const rejectedB = new Map<string, number>();
        for (const b of (allBids ?? [])) {
          totalB.set(b.provider_id, (totalB.get(b.provider_id) ?? 0) + 1);
          if (b.status === 'rejected') rejectedB.set(b.provider_id, (rejectedB.get(b.provider_id) ?? 0) + 1);
        }
        H = ['الاسم', 'الهاتف', 'المدينة', 'الخطة', 'مستوى السمعة', 'التقييم', 'وظائف منجزة', 'إجمالي العروض', 'عروض مرفوضة', 'معدل الرفض %', 'بلاغات', 'الحالة'];
        R = (provs ?? []).map((p: any) => {
          const tot = totalB.get(p.id) ?? 0;
          const rej = rejectedB.get(p.id) ?? 0;
          return [
            p.user?.full_name, p.user?.phone, p.user?.city,
            subLbl(p.subscription_tier), tierLbl(p.reputation_tier),
            p.score, p.lifetime_jobs, tot, rej,
            tot > 0 ? Math.round((rej / tot) * 100) : 0,
            p.flag_count,
            p.is_active ? 'نشط' : 'موقوف',
          ];
        });
        filename = `c01-provider-performance-${today}.csv`;
        break;
      }

      case 'c02': { // المقدمون الخاملون (مشترك لكن لا عروض 30 يوم)
        const [{ data: provs }, { data: activeBids }] = await Promise.all([
          supabaseAdmin.from('providers').select('id, subscription_tier, subscription_ends, lifetime_jobs, score, user:users!providers_id_fkey(full_name, phone, city)').eq('is_subscribed', true),
          supabaseAdmin.from('bids').select('provider_id').gte('created_at', ago30d),
        ]);
        const activeSet = new Set((activeBids ?? []).map(b => b.provider_id));
        H = ['الاسم', 'الهاتف', 'المدينة', 'الخطة', 'انتهاء الاشتراك', 'وظائف منجزة', 'التقييم'];
        R = (provs ?? [])
          .filter((p: any) => !activeSet.has(p.id))
          .map((p: any) => [
            p.user?.full_name, p.user?.phone, p.user?.city,
            subLbl(p.subscription_tier), fmtD(p.subscription_ends),
            p.lifetime_jobs, p.score,
          ]);
        filename = `c02-idle-providers-${today}.csv`;
        break;
      }

      case 'c03': { // المقدمون المُبلَّغ عنهم (بلاغات غير مراجَعة)
        const { data } = await supabaseAdmin
          .from('provider_flags')
          .select(`
            reason, details, created_at,
            provider:providers!provider_flags_provider_id_fkey(
              flag_count, reputation_tier,
              user:users!providers_id_fkey(full_name, phone, city)
            )
          `)
          .eq('reviewed', false)
          .order('created_at', { ascending: false });
        H = ['الاسم', 'الهاتف', 'المدينة', 'سبب البلاغ', 'مستوى السمعة', 'إجمالي البلاغات', 'تاريخ البلاغ'];
        const reasonMap: Record<string, string> = {
          low_rating: 'تقييم منخفض', high_rejection: 'رفض مرتفع',
          complaints: 'شكاوى', job_abandonment: 'تخلٍّ عن وظيفة',
        };
        R = (data ?? []).map((f: any) => [
          (f.provider as any)?.user?.full_name,
          (f.provider as any)?.user?.phone,
          (f.provider as any)?.user?.city,
          reasonMap[f.reason] ?? f.reason,
          tierLbl((f.provider as any)?.reputation_tier),
          (f.provider as any)?.flag_count,
          fmtDT(f.created_at),
        ]);
        filename = `c03-flagged-providers-${today}.csv`;
        break;
      }

      case 'c04': { // المقدمون الموقوفون
        const { data } = await supabaseAdmin
          .from('providers')
          .select('suspension_reason, suspended_at, lifetime_jobs, score, user:users!providers_id_fkey(full_name, phone, city)')
          .eq('is_active', false)
          .order('suspended_at', { ascending: false });
        H = ['الاسم', 'الهاتف', 'المدينة', 'سبب الإيقاف', 'تاريخ الإيقاف', 'وظائف منجزة', 'التقييم'];
        R = (data ?? []).map((p: any) => [
          p.user?.full_name, p.user?.phone, p.user?.city,
          p.suspension_reason ?? '—', fmtDT(p.suspended_at),
          p.lifetime_jobs, p.score,
        ]);
        filename = `c04-suspended-providers-${today}.csv`;
        break;
      }

      case 'c05': { // توزيع المقدمين
        const { data } = await supabaseAdmin
          .from('providers')
          .select('is_subscribed, reputation_tier, subscription_tier, user:users!providers_id_fkey(city)');
        type Key = string;
        const tally = new Map<Key, { total: number; subscribed: number }>();
        for (const p of (data ?? [])) {
          const city = (p.user as any)?.city ?? '—';
          const tier = tierLbl(p.reputation_tier);
          const k    = `${city}||${tier}`;
          const v    = tally.get(k) ?? { total: 0, subscribed: 0 };
          v.total++;
          if (p.is_subscribed) v.subscribed++;
          tally.set(k, v);
        }
        H = ['المدينة', 'مستوى السمعة', 'إجمالي المقدمين', 'مشتركون', 'غير مشتركين'];
        R = Array.from(tally.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([k, v]) => {
            const [city, tier] = k.split('||');
            return [city, tier, v.total, v.subscribed, v.total - v.subscribed];
          });
        filename = `c05-provider-distribution-${today}.csv`;
        break;
      }

      case 'c06': { // أعلى 20 مقدم أداءً
        const { data } = await supabaseAdmin
          .from('providers')
          .select('subscription_tier, reputation_tier, score, lifetime_jobs, flag_count, user:users!providers_id_fkey(full_name, phone, city)')
          .order('lifetime_jobs', { ascending: false })
          .order('score', { ascending: false })
          .limit(20);
        H = ['#', 'الاسم', 'الهاتف', 'المدينة', 'الخطة', 'مستوى السمعة', 'التقييم', 'وظائف منجزة', 'بلاغات'];
        R = (data ?? []).map((p: any, i: number) => [
          i + 1,
          p.user?.full_name, p.user?.phone, p.user?.city,
          subLbl(p.subscription_tier), tierLbl(p.reputation_tier),
          p.score, p.lifetime_jobs, p.flag_count,
        ]);
        filename = `c06-top-providers-${today}.csv`;
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GROUP D — USERS & GROWTH
      // ════════════════════════════════════════════════════════════════════════

      case 'd01': { // المستخدمون الجدد (30 يوم)
        const { data } = await supabaseAdmin
          .from('users')
          .select('full_name, phone, city, role, created_at')
          .gte('created_at', ago30d)
          .order('created_at', { ascending: false });
        const roleMap: Record<string, string> = { client: 'عميل', provider: 'مقدم خدمة', admin: 'مدير' };
        H = ['الاسم', 'الهاتف', 'المدينة', 'النوع', 'تاريخ التسجيل'];
        R = (data ?? []).map((u: any) => [
          u.full_name, u.phone, u.city,
          roleMap[u.role] ?? u.role, fmtDT(u.created_at),
        ]);
        filename = `d01-new-users-${today}.csv`;
        break;
      }

      case 'd02': { // الاحتفاظ بالعملاء (2+ طلبات في 90 يوم)
        const { data: reqs } = await supabaseAdmin
          .from('requests')
          .select('client_id')
          .gte('created_at', ago90d)
          .neq('status', 'cancelled');
        const byClient = new Map<string, number>();
        for (const r of (reqs ?? [])) byClient.set(r.client_id, (byClient.get(r.client_id) ?? 0) + 1);
        const retainedIds = [...byClient.entries()].filter(([, c]) => c >= 2).map(([id]) => id);
        if (!retainedIds.length) {
          csv = toCsv(['الرسالة'], [['لا يوجد عملاء بطلبين أو أكثر في آخر 90 يوم']]);
          filename = `d02-retained-clients-${today}.csv`;
          break;
        }
        const { data: users } = await supabaseAdmin.from('users').select('id, full_name, phone, city').in('id', retainedIds);
        H = ['الاسم', 'الهاتف', 'المدينة', 'عدد الطلبات (90 يوم)'];
        R = (users ?? [])
          .map((u: any) => [u.full_name, u.phone, u.city, byClient.get(u.id) ?? 0])
          .sort((a: any, b: any) => Number(b[3]) - Number(a[3]));
        filename = `d02-retained-clients-${today}.csv`;
        break;
      }

      case 'd03': { // العملاء الخاملون (لم يطلبوا أبداً)
        const [{ data: clients }, { data: active }] = await Promise.all([
          supabaseAdmin.from('users').select('id, full_name, phone, city, created_at').eq('role', 'client'),
          supabaseAdmin.from('requests').select('client_id'),
        ]);
        const activeSet = new Set((active ?? []).map(r => r.client_id));
        H = ['الاسم', 'الهاتف', 'المدينة', 'تاريخ التسجيل'];
        R = (clients ?? [])
          .filter((u: any) => !activeSet.has(u.id))
          .map((u: any) => [u.full_name, u.phone, u.city, fmtD(u.created_at)]);
        filename = `d03-idle-clients-${today}.csv`;
        break;
      }

      case 'd04': { // توزيع المستخدمين (بالمدينة والنوع)
        const { data } = await supabaseAdmin.from('users').select('city, role');
        const tally = new Map<string, { clients: number; providers: number }>();
        for (const u of (data ?? [])) {
          const city = u.city ?? '—';
          const v    = tally.get(city) ?? { clients: 0, providers: 0 };
          if (u.role === 'client')   v.clients++;
          if (u.role === 'provider') v.providers++;
          tally.set(city, v);
        }
        H = ['المدينة', 'عملاء', 'مقدمو خدمة', 'الإجمالي'];
        R = Array.from(tally.entries())
          .sort((a, b) => (b[1].clients + b[1].providers) - (a[1].clients + a[1].providers))
          .map(([city, v]) => [city, v.clients, v.providers, v.clients + v.providers]);
        filename = `d04-user-distribution-${today}.csv`;
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GROUP E — QUALITY & SAFETY
      // ════════════════════════════════════════════════════════════════════════

      case 'e01': { // الإلغاءات (30 يوم)
        const { data } = await supabaseAdmin
          .from('requests')
          .select(`
            title, city, category_slug, cancelled_reason, created_at,
            client:users!requests_client_id_fkey(full_name, phone)
          `)
          .eq('status', 'cancelled')
          .gte('created_at', ago30d)
          .order('created_at', { ascending: false });
        H = ['العنوان', 'المدينة', 'الفئة', 'سبب الإلغاء', 'العميل', 'هاتف العميل', 'التاريخ'];
        R = (data ?? []).map((r: any) => [
          r.title, r.city, r.category_slug,
          cancelLbl(r.cancelled_reason),
          (r.client as any)?.full_name, (r.client as any)?.phone,
          fmtDT(r.created_at),
        ]);
        filename = `e01-cancellations-${today}.csv`;
        break;
      }

      case 'e02': { // البلاغات المعلّقة
        const { data } = await supabaseAdmin
          .from('reports')
          .select(`
            report_type, description, status, created_at,
            reporter:users!reports_reporter_id_fkey(full_name, phone),
            reported:users!reports_reported_user_id_fkey(full_name, phone)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        H = ['المُبلِّغ', 'هاتف المُبلِّغ', 'المُبلَّغ عنه', 'هاتفه', 'نوع البلاغ', 'الوصف', 'التاريخ'];
        R = (data ?? []).map((r: any) => [
          (r.reporter as any)?.full_name, (r.reporter as any)?.phone,
          (r.reported as any)?.full_name, (r.reported as any)?.phone,
          reportTypeLbl(r.report_type), r.description ?? '',
          fmtDT(r.created_at),
        ]);
        filename = `e02-pending-reports-${today}.csv`;
        break;
      }

      case 'e03': { // الإلغاءات المتكررة (3+ في 90 يوم)
        const { data: cancelled } = await supabaseAdmin
          .from('requests')
          .select('client_id')
          .eq('status', 'cancelled')
          .eq('cancelled_reason', 'by_client')
          .gte('created_at', ago90d);
        const byClient = new Map<string, number>();
        for (const r of (cancelled ?? [])) byClient.set(r.client_id, (byClient.get(r.client_id) ?? 0) + 1);
        const repeatIds = [...byClient.entries()].filter(([, c]) => c >= 3).map(([id]) => id);
        if (!repeatIds.length) {
          csv = toCsv(['الرسالة'], [['لا يوجد مستخدمون بثلاثة إلغاءات أو أكثر في آخر 90 يوم']]);
          filename = `e03-repeat-cancellers-${today}.csv`;
          break;
        }
        const { data: users } = await supabaseAdmin.from('users').select('id, full_name, phone, city').in('id', repeatIds);
        H = ['الاسم', 'الهاتف', 'المدينة', 'عدد الإلغاءات (90 يوم)'];
        R = (users ?? [])
          .map((u: any) => [u.full_name, u.phone, u.city, byClient.get(u.id) ?? 0])
          .sort((a: any, b: any) => Number(b[3]) - Number(a[3]));
        filename = `e03-repeat-cancellers-${today}.csv`;
        break;
      }

      case 'e04': { // التقييمات المنخفضة (1-2 نجوم)
        const { data } = await supabaseAdmin
          .from('jobs')
          .select(`
            client_rating, client_review, confirmed_at,
            request:requests!jobs_request_id_fkey(title, city, category_slug),
            provider:providers!jobs_provider_id_fkey(user:users!providers_id_fkey(full_name, phone)),
            client:users!jobs_client_id_fkey(full_name)
          `)
          .lte('client_rating', 2)
          .not('client_rating', 'is', null)
          .order('confirmed_at', { ascending: false });
        H = ['مقدم الخدمة', 'هاتفه', 'العميل', 'الطلب', 'المدينة', 'الفئة', 'التقييم', 'التعليق', 'تاريخ الإكمال'];
        R = (data ?? []).map((j: any) => [
          (j.provider as any)?.user?.full_name, (j.provider as any)?.user?.phone,
          j.client?.full_name,
          (j.request as any)?.title, (j.request as any)?.city, (j.request as any)?.category_slug,
          j.client_rating, j.client_review ?? '', fmtDT(j.confirmed_at),
        ]);
        filename = `e04-low-ratings-${today}.csv`;
        break;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GROUP F — SYSTEM & AUDIT
      // ════════════════════════════════════════════════════════════════════════

      case 'f01': { // سجل إجراءات الأدمن
        const { data } = await supabaseAdmin
          .from('admin_audit_log')
          .select('action, target_type, target_label, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(10_000);
        const actionMap: Record<string, string> = {
          disable_user:     'تعطيل مستخدم',
          enable_user:      'تفعيل مستخدم',
          verify_provider:  'توثيق مقدم',
          suspend_provider: 'إيقاف مقدم',
          warn_provider:    'تحذير مقدم',
          clear_provider:   'تبرئة مقدم',
          activate_sub:     'تفعيل اشتراك',
        };
        H = ['الإجراء', 'نوع الهدف', 'الهدف', 'السبب', 'التاريخ'];
        R = (data ?? []).map((l: any) => [
          actionMap[l.action] ?? l.action,
          l.target_type, l.target_label ?? '',
          l.reason ?? '', fmtDT(l.created_at),
        ]);
        filename = `f01-audit-log-${today}.csv`;
        break;
      }

      case 'f02': { // Edge Function errors — not in DB
        csv = toCsv(
          ['ملاحظة', 'رابط'],
          [['سجلات أخطاء Edge Functions تُعرض في Supabase Dashboard فقط وليست مخزّنة في قاعدة البيانات', 'https://supabase.com/dashboard/project/_/functions']],
        );
        filename = `f02-edge-functions-note-${today}.csv`;
        break;
      }

      case 'f03': { // الملخص الأسبوعي
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          return d;
        });
        // Use days[0] (6 days ago midnight) as query start — aligns with bucket boundaries
        const weekStart = days[0].toISOString();
        const [
          { data: usersData }, { data: reqsData }, { data: jobsData },
          { data: pmtData },   { data: rptData },  { data: flagData },
        ] = await Promise.all([
          supabaseAdmin.from('users').select('created_at, role').gte('created_at', weekStart),
          supabaseAdmin.from('requests').select('created_at, status').gte('created_at', weekStart),
          supabaseAdmin.from('jobs').select('confirmed_at').eq('confirmed_by_client', true).not('confirmed_at', 'is', null).gte('confirmed_at', weekStart),
          supabaseAdmin.from('manual_payments').select('created_at, amount_jod').gte('created_at', weekStart),
          supabaseAdmin.from('reports').select('created_at').gte('created_at', weekStart),
          supabaseAdmin.from('provider_flags').select('created_at').gte('created_at', weekStart),
        ]);
        H = ['التاريخ', 'مستخدمون جدد', 'عملاء', 'مقدمون', 'طلبات', 'وظائف مكتملة', 'إيراد يدوي (دينار)', 'بلاغات', 'إشارات مقدمين'];
        R = days.map(dayStart => {
          const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
          const inDay  = (iso: string) => { const t = new Date(iso).getTime(); return t >= dayStart.getTime() && t < dayEnd.getTime(); };
          const label  = dayStart.toLocaleDateString('ar-JO', { weekday: 'short', day: 'numeric', month: 'short' });
          const nc = (usersData ?? []).filter(u => inDay(u.created_at) && u.role === 'client').length;
          const np = (usersData ?? []).filter(u => inDay(u.created_at) && u.role === 'provider').length;
          const nr = (reqsData ?? []).filter(r => inDay(r.created_at)).length;
          const nj = (jobsData ?? []).filter(j => j.confirmed_at && inDay(j.confirmed_at)).length;
          const rv = (pmtData  ?? []).filter(p => inDay(p.created_at)).reduce((s, p) => s + Number(p.amount_jod), 0);
          const nb = (rptData  ?? []).filter(r => inDay(r.created_at)).length;
          const nf = (flagData ?? []).filter(f => inDay(f.created_at)).length;
          return [label, nc + np, nc, np, nr, nj, rv.toFixed(3), nb, nf];
        });
        filename = `f03-weekly-summary-${today}.csv`;
        break;
      }

      default:
        return Response.json({ error: 'تقرير غير موجود' }, { status: 404 });
    }

    if (!csv) csv = toCsv(H, R);

    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err) {
    console.error(`[reports/${id}] export error:`, err);
    return Response.json({ error: 'فشل تصدير التقرير' }, { status: 500 });
  }
}
