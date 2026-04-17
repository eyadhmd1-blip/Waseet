// ============================================================
// WASEET — provider-page Edge Function
// Serves a beautiful Arabic HTML page for provider public profiles.
// URL: https://<project>.supabase.co/functions/v1/provider-page?u=<username>
//      https://<project>.supabase.co/functions/v1/provider-page?id=<uuid>
//
// When a user opens a shared link:
//   - Has the app installed → JS detects & redirects to deep link
//   - Doesn't have app     → sees a beautiful landing page + download CTA
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIER_LABELS: Record<string, string> = {
  new: 'جديد', rising: 'صاعد', trusted: 'موثوق', expert: 'خبير', elite: 'نخبة',
};
const TIER_COLORS: Record<string, string> = {
  new: '#94A3B8', rising: '#60A5FA', trusted: '#34D399', expert: '#FBBF24', elite: '#F472B6',
};

serve(async (req) => {
  const url    = new URL(req.url);
  const username = url.searchParams.get('u');
  const id       = url.searchParams.get('id');

  if (!username && !id) {
    return new Response('Missing provider identifier', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch provider
  let query = supabase
    .from('public_provider_profiles')
    .select('*');

  if (username) query = query.eq('username', username);
  else          query = query.eq('id', id);

  const { data: prov } = await query.single();

  if (!prov) {
    return new Response('<h1>المزود غير موجود</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Fetch portfolio (max 6 public items)
  const { data: portfolio } = await supabase
    .from('portfolio_items')
    .select('id, item_type, media_urls, views_count')
    .eq('provider_id', prov.id)
    .limit(6);

  // Track view
  supabase.rpc('increment_profile_view', { p_provider_id: prov.id }).catch(() => {});

  const tierColor = TIER_COLORS[prov.reputation_tier] ?? '#94A3B8';
  const tierLabel = TIER_LABELS[prov.reputation_tier] ?? prov.reputation_tier;
  const appDeepLink = `waseet://provider-profile?provider_id=${prov.id}`;
  const appStoreUrl = 'https://apps.apple.com/app/waseet';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.waseet.app';

  const portfolioHTML = (portfolio ?? []).map(item => {
    const thumb = item.media_urls?.[0];
    return thumb
      ? `<div class="port-thumb" style="background-image:url('${thumb}')">
           ${item.item_type === 'before_after' ? '<span class="port-badge">🔄</span>' : ''}
         </div>`
      : `<div class="port-thumb port-video"><span>🎥</span></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${prov.full_name} — وسيط</title>
  <meta name="description" content="مزود خدمة موثّق على تطبيق وسيط · ${prov.city} · ${prov.lifetime_jobs} عمل منجز" />
  <meta property="og:title"       content="${prov.full_name} — وسيط" />
  <meta property="og:description" content="تقييم ${prov.score?.toFixed(1) ?? '—'} ⭐ · ${prov.lifetime_jobs} عمل · ${tierLabel}" />
  <meta property="og:type"        content="profile" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', sans-serif;
      background: #0F172A;
      color: #F1F5F9;
      min-height: 100vh;
    }
    .container { max-width: 480px; margin: 0 auto; padding: 24px 16px 80px; }

    /* App bar */
    .app-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 24px; }
    .logo    { font-size: 22px; font-weight: 800; color: #F59E0B; }
    .open-app-btn {
      background: #F59E0B; color: #0F172A; font-weight: 700;
      border: none; border-radius: 12px; padding: 10px 18px;
      font-size: 14px; cursor: pointer; text-decoration: none;
    }

    /* Hero card */
    .hero {
      background: #1E293B; border-radius: 20px; padding: 20px;
      border: 1px solid #334155; margin-bottom: 16px;
    }
    .hero-top  { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .avatar {
      width: 72px; height: 72px; border-radius: 36px;
      background: ${tierColor}33;
      display: flex; align-items: center; justify-content: center;
      font-size: 30px; font-weight: 800; color: ${tierColor};
      flex-shrink: 0;
    }
    .name  { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .city  { font-size: 13px; color: #64748B; margin-bottom: 8px; }
    .badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge {
      border-radius: 8px; padding: 3px 8px; font-size: 11px; font-weight: 700;
    }
    .tier-badge { background: ${tierColor}22; color: ${tierColor}; }
    .verified-badge { background: #0C4A6E; color: #7DD3FC; }
    .recommended-badge { background: #78350F; color: #FCD34D; }

    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .stat-box {
      background: #0F172A; border-radius: 12px; padding: 10px 6px;
      text-align: center; border: 1px solid #334155;
    }
    .stat-value { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .stat-label { font-size: 10px; color: #64748B; }

    /* Portfolio */
    .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 10px; }
    .port-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; border-radius: 12px; overflow: hidden; }
    .port-thumb {
      aspect-ratio: 1; background-size: cover; background-position: center;
      background-color: #1E293B; position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .port-video { font-size: 24px; color: #64748B; }
    .port-badge {
      position: absolute; top: 4px; right: 4px;
      background: #00000088; border-radius: 4px; padding: 2px 4px; font-size: 10px;
    }

    /* CTA */
    .cta-card {
      background: #1C1A0E; border-radius: 16px; padding: 20px;
      border: 1px solid #78350F; text-align: center; margin-top: 20px;
    }
    .cta-title { font-size: 18px; font-weight: 800; color: #F59E0B; margin-bottom: 8px; }
    .cta-sub   { font-size: 13px; color: #92400E; margin-bottom: 20px; line-height: 1.5; }
    .store-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .store-btn {
      background: #F59E0B; color: #0F172A; font-weight: 700;
      border-radius: 12px; padding: 12px 20px; text-decoration: none;
      font-size: 14px; display: inline-block;
    }
    .store-btn.secondary {
      background: transparent; color: #F59E0B;
      border: 1px solid #F59E0B;
    }

    /* Already has app section */
    #already-app { display: none; margin-top: 16px; text-align: center; }
    .open-in-app {
      display: inline-block; background: #F59E0B; color: #0F172A;
      font-weight: 700; border-radius: 14px; padding: 14px 32px;
      text-decoration: none; font-size: 16px; width: 100%;
    }
    .app-hint { font-size: 12px; color: #64748B; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- App bar -->
    <div class="app-bar">
      <span class="logo">وسيط</span>
      <a class="open-app-btn" href="${appDeepLink}">فتح في التطبيق</a>
    </div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-top">
        <div class="avatar">${prov.full_name.charAt(0)}</div>
        <div style="flex:1">
          <div class="name">${prov.full_name}</div>
          <div class="city">📍 ${prov.city}</div>
          <div class="badges">
            <span class="badge tier-badge">${tierLabel}</span>
            ${prov.badge_verified ? '<span class="badge verified-badge">✓ موثّق</span>' : ''}
            ${(prov.share_count ?? 0) >= 5 ? '<span class="badge recommended-badge">🏅 موصى به</span>' : ''}
          </div>
        </div>
      </div>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-value">${prov.score > 0 ? prov.score.toFixed(1) : '—'} ⭐</div>
          <div class="stat-label">التقييم</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${prov.lifetime_jobs}</div>
          <div class="stat-label">عمل منجز</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${prov.share_count ?? 0} ⬆️</div>
          <div class="stat-label">مشاركة</div>
        </div>
      </div>
    </div>

    <!-- Portfolio -->
    ${portfolioHTML ? `
    <div class="section-title">معرض الأعمال</div>
    <div class="port-grid">${portfolioHTML}</div>
    ` : ''}

    <!-- CTA -->
    <div class="cta-card">
      <div class="cta-title">حمّل تطبيق وسيط</div>
      <div class="cta-sub">
        للتواصل مع ${prov.full_name} وآلاف المزودين الموثّقين في الأردن
      </div>
      <div class="store-btns">
        <a class="store-btn" href="${appStoreUrl}">App Store 🍎</a>
        <a class="store-btn secondary" href="${playStoreUrl}">Google Play 🤖</a>
      </div>
    </div>
  </div>

  <script>
    // Try to open the app via deep link; if it works, show "already installed" CTA
    const deepLink = '${appDeepLink}';
    let appOpened = false;

    window.addEventListener('blur', () => { appOpened = true; });

    setTimeout(() => {
      if (!appOpened) {
        // App not installed — page stays (already showing download CTA)
      }
    }, 1500);

    // Attempt deep link on page load for returning users
    window.location.href = deepLink;
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
