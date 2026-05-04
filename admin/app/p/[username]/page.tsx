import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '../../lib/supabase';
import { LandingPageClient } from './landing-client';

interface Props {
  params: Promise<{ username: string }>;
}

async function getProvider(slug: string) {
  // Try by username first
  const { data: byUsername } = await supabaseAdmin
    .from('public_provider_profiles')
    .select('id, username, full_name, city, score, reputation_tier, lifetime_jobs, badge_verified, bio, categories')
    .eq('username', slug)
    .maybeSingle();

  if (byUsername) return byUsername;

  // Fall back to UUID (provider_id passed as slug)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  if (!isUUID) return null;

  const { data: byId } = await supabaseAdmin
    .from('public_provider_profiles')
    .select('id, username, full_name, city, score, reputation_tier, lifetime_jobs, badge_verified, bio, categories')
    .eq('id', slug)
    .maybeSingle();

  return byId ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const provider = await getProvider(username);

  if (!provider) return { title: 'وسيط' };

  const name = provider.full_name as string;
  const desc = (provider.bio as string | null) ?? `${name} — مزود خدمة معتمد على منصة وسيط`;
  const url  = `https://waseet.app/p/${username}`;

  return {
    title:       `${name} | وسيط`,
    description: desc,
    openGraph: {
      title:       `${name} | وسيط`,
      description: desc,
      url,
      type:        'profile',
      siteName:    'وسيط',
    },
    twitter: {
      card:        'summary',
      title:       `${name} | وسيط`,
      description: desc,
    },
  };
}

export default async function ProviderLandingPage({ params }: Props) {
  const { username } = await params;
  const provider = await getProvider(username);

  if (!provider) notFound();

  return <LandingPageClient provider={provider as any} />;
}
