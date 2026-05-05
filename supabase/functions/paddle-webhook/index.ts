// Supabase Edge Function — paddle-webhook
// Deno runtime
//
// Receives Paddle webhook events and activates/renews provider subscriptions.
// Configure in Paddle Dashboard → Notifications → New Notification:
//   URL: https://<project>.supabase.co/functions/v1/paddle-webhook
//   Events: transaction.completed, subscription.activated, subscription.renewed,
//           subscription.canceled
//
// ENV vars required (set in Supabase → Edge Functions → Secrets):
//   PADDLE_WEBHOOK_SECRET  — from Paddle Dashboard → Notifications → Secret key
//   SUPABASE_URL           — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "paddle-signature, content-type",
};

// Map Paddle price IDs to subscription tiers
// Fill these in once you create products in Paddle Dashboard
const PRICE_TO_TIER: Record<string, "basic" | "pro" | "premium"> = {
  // "pri_xxxxxxxx": "basic",
  // "pri_yyyyyyyy": "pro",
  // "pri_zzzzzzzz": "premium",
};

const TIER_PRICE_JOD: Record<string, number> = {
  trial:    0,
  basic:    5,
  pro:     12,
  premium: 22,
};


async function verifyPaddleSignature(
  req: Request,
  body: string
): Promise<boolean> {
  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!secret) return false;

  const signatureHeader = req.headers.get("paddle-signature");
  if (!signatureHeader) return false;

  // Paddle signature format: ts=<timestamp>;h1=<hmac>
  const parts = Object.fromEntries(
    signatureHeader.split(";").map(p => p.split("=") as [string, string])
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const payload = `${ts}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === h1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.text();

    // ── Verify webhook signature ──────────────────────────────
    const valid = await verifyPaddleSignature(req, body);
    if (!valid) return json({ error: "invalid_signature" }, 401);

    const event = JSON.parse(body) as {
      event_type: string;
      data: Record<string, unknown>;
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Handle events ─────────────────────────────────────────
    switch (event.event_type) {

      case "transaction.completed":
      case "subscription.activated":
      case "subscription.renewed": {
        const data = event.data as {
          id: string;
          customer_id: string;
          items: { price: { id: string } }[];
          current_billing_period?: { ends_at: string };
          status: string;
          custom_data?: { provider_id?: string; tier?: string };
        };

        const providerId = data.custom_data?.provider_id;
        if (!providerId) break; // not a subscription event we initiated

        const priceId = data.items?.[0]?.price?.id;
        // custom_data.tier takes precedence (set at checkout passthrough)
        const tierFromPrice = priceId ? PRICE_TO_TIER[priceId] : undefined;
        const tier = (data.custom_data?.tier ?? tierFromPrice) as string | undefined;

        if (!tier) {
          // Unknown price ID — log and skip rather than silently activating wrong tier
          console.warn(`[paddle-webhook] Unknown priceId "${priceId}" for provider ${providerId}. Add to PRICE_TO_TIER map.`);
          break;
        }

        // Load provider to check trial eligibility
        const { data: providerRow } = await supabaseAdmin
          .from("providers")
          .select("trial_used")
          .eq("id", providerId)
          .single();

        // Block trial re-use
        if (tier === "trial" && providerRow?.trial_used) break;

        const amountPaid = TIER_PRICE_JOD[tier] ?? 5;

        // Activate subscription via RPC (handles credits, trial_used, discount resets)
        await supabaseAdmin.rpc("activate_provider_subscription", {
          p_provider_id:   providerId,
          p_tier:          tier,
          p_period_months: 1,
        });

        // Record subscription history
        await supabaseAdmin.from("subscriptions").insert({
          provider_id:   providerId,
          tier,
          amount_paid:   amountPaid,
          currency:      "JOD",
          discount_pct:  0,
          period_start:  new Date().toISOString(),
          period_end:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paddle_txn_id: data.id,
        });
        break;
      }

      case "subscription.canceled": {
        const data = event.data as {
          custom_data?: { provider_id?: string };
          scheduled_change?: { effective_at: string };
        };
        const providerId = data.custom_data?.provider_id;
        if (!providerId) break;

        // Mark as unsubscribed when the period ends (not immediately)
        // The subscription_ends date already controls access
        // Just set is_subscribed = false if already past end date
        await supabaseAdmin.from("providers").update({
          is_subscribed: false,
          updated_at:    new Date().toISOString(),
        }).eq("id", providerId).lt("subscription_ends", new Date().toISOString());
        break;
      }

      default:
        // Acknowledge unknown events without processing
        break;
    }

    return json({ received: true });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
