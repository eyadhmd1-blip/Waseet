'use client';

import { useEffect, useRef } from 'react';

interface Provider {
  id: string;
  username: string | null;
  full_name: string;
  city: string | null;
  score: number | null;
  reputation_tier: string | null;
  lifetime_jobs: number | null;
  badge_verified: boolean;
  bio: string | null;
  categories: string[] | null;
}

// Fill in once apps are published on stores
const IOS_STORE_URL     = 'https://apps.apple.com/app/waseet/idPLACEHOLDER';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.waseet.app';

const TIER_LABEL: Record<string, string> = {
  new:     'جديد',
  rising:  'صاعد',
  trusted: 'موثوق',
  expert:  'خبير',
  elite:   'نخبة',
};

const TIER_COLOR: Record<string, string> = {
  new:     'bg-slate-500',
  rising:  'bg-blue-500',
  trusted: 'bg-green-500',
  expert:  'bg-purple-500',
  elite:   'bg-amber-500',
};

export function LandingPageClient({ provider }: { provider: Provider }) {
  const attempted = useRef(false);

  // Auto-attempt to open the app via custom URL scheme on load
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    window.location.href = `mobile://provider-profile?provider_id=${provider.id}`;
  }, [provider.id]);

  const openApp = () => {
    window.location.href = `mobile://provider-profile?provider_id=${provider.id}`;
  };

  const initials = provider.full_name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('');

  const tierColor = TIER_COLOR[provider.reputation_tier ?? 'new'] ?? 'bg-slate-500';
  const tierLabel = TIER_LABEL[provider.reputation_tier ?? 'new'] ?? '';

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      {/* App brand */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-amber-400">وسيط</h1>
        <p className="text-slate-400 text-sm mt-1">منصة الخدمات المنزلية</p>
      </div>

      {/* Provider card */}
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
        {/* Avatar + identity */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-white mb-3 select-none">
            {initials}
          </div>
          <h2 className="text-xl font-bold text-white text-center">{provider.full_name}</h2>
          {provider.badge_verified && (
            <span className="text-blue-400 text-sm mt-1">✓ مزود معتمد</span>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
            {provider.city && (
              <span className="text-slate-400 text-sm">📍 {provider.city}</span>
            )}
            {provider.score !== null && (
              <span className="text-amber-400 text-sm font-semibold">⭐ {Number(provider.score).toFixed(1)}</span>
            )}
          </div>
        </div>

        {/* Tier + jobs */}
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {provider.reputation_tier && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${tierColor}`}>
              {tierLabel}
            </span>
          )}
          {(provider.lifetime_jobs ?? 0) > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
              {provider.lifetime_jobs} مهمة منجزة
            </span>
          )}
        </div>

        {/* Bio */}
        {provider.bio && (
          <p className="text-slate-300 text-sm text-center mb-4 leading-relaxed line-clamp-3">
            {provider.bio}
          </p>
        )}

        {/* Categories */}
        {provider.categories && provider.categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {provider.categories.slice(0, 4).map((cat: string) => (
              <span key={cat} className="px-2 py-1 bg-slate-700 rounded-lg text-xs text-slate-300">
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Open in app */}
        <button
          onClick={openApp}
          className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-bold py-3 px-6 rounded-xl text-base transition-colors mb-4"
        >
          فتح في التطبيق
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-xs whitespace-nowrap">أو تنزيل التطبيق</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Store buttons */}
        <div className="flex gap-3">
          <a
            href={IOS_STORE_URL}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            🍎 App Store
          </a>
          <a
            href={ANDROID_STORE_URL}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            🤖 Play Store
          </a>
        </div>
      </div>

      <p className="text-slate-600 text-xs mt-6 text-center">
        © {new Date().getFullYear()} وسيط — جميع الحقوق محفوظة
      </p>
    </div>
  );
}
