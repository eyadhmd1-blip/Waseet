// ============================================================
// WASEET — notify-contract Edge Function
// Called after a recurring contract is created.
// Finds subscribed providers in the same city + category and
// sends them a push notification.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE    = 50;

serve(async (req) => {
  try {
    const { contract_id, city, category_slug } = await req.json();
    if (!contract_id || !city || !category_slug) {
      return new Response(JSON.stringify({ error: 'missing params' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch contract title
    const { data: contract } = await supabase
      .from('recurring_contracts')
      .select('title')
      .eq('id', contract_id)
      .single();

    // Get subscribed providers in same city+category
    const { data: targets } = await supabase.rpc('get_available_providers_for_contract', {
      p_city:          city,
      p_category_slug: category_slug,
    });

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'no matching providers' }), { status: 200 });
    }

    const messages = targets.map((t: { token: string }) => ({
      to:       t.token,
      title:    '📋 عقد دوري جديد',
      body:     `${contract?.title ?? 'عقد خدمة دورية'} — ${city}`,
      data:     { screen: 'contract_feed', contract_id },
      sound:    'default',
      priority: 'high',
    }));

    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
