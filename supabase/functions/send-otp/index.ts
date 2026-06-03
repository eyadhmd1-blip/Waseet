// Supabase Edge Function — send-otp
// Deno runtime
// Sends an OTP SMS via Twilio (primary) or Unifonic (fallback).
//
// ENV vars required (set in Supabase Dashboard → Edge Functions → Secrets):
//   TWILIO_ACCOUNT_SID  — Twilio Account SID (primary provider)
//   TWILIO_AUTH_TOKEN   — Twilio Auth Token
//   TWILIO_FROM_NUMBER  — Twilio phone number e.g. "+12345678901"
//   UNIFONIC_APP_SID    — Unifonic (fallback if Twilio not configured)
//   ENVIRONMENT         — "development" to return OTP in response (testing only)
//
// Request body: { phone: string }  — E.164 format e.g. "+962791234567"
// Response:     { success: true } | { error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone to E.164 (+962xxxxxxxxx)
function toE164(phone: string): string {
  const p = phone.trim().replace(/\s+/g, "");
  if (p.startsWith("+962")) return p;
  if (p.startsWith("00962")) return "+" + p.slice(2);
  if (p.startsWith("0") && !p.startsWith("00")) return "+962" + p.slice(1);
  if (/^7[789]/.test(p)) return "+962" + p;
  return p;
}

// Normalize phone to 00962 format for Unifonic
function toUnifonic(phone: string): string {
  const e164 = toE164(phone);
  return "00962" + e164.slice(4);
}

async function sendViaTwilio(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from       = Deno.env.get("TWILIO_FROM_NUMBER")!;

  const credentials = btoa(`${accountSid}:${authToken}`);

  const formData = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );

  const result = await res.json();
  if (!res.ok || result?.status === "failed" || result?.error_code) {
    console.error("[send-otp] Twilio error:", result);
    return { ok: false, error: result?.message ?? "TWILIO_FAILED" };
  }
  return { ok: true };
}

async function sendViaUnifonic(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const appSid = Deno.env.get("UNIFONIC_APP_SID")!;

  const formData = new URLSearchParams({
    AppSid:       appSid,
    Recipient:    toUnifonic(to),
    Body:         body,
    SenderID:     "Waseet",
    responseType: "JSON",
  });

  const res = await fetch(
    "https://el.cloud.unifonic.com/rest/SMS/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    }
  );

  const result = await res.json();
  if (!res.ok || result?.Success === false) {
    console.error("[send-otp] Unifonic error:", result);
    return { ok: false, error: "UNIFONIC_FAILED" };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phone.trim().replace(/\s+/g, "");

    // ── Google Play reviewer test account ──────────────────────────────────
    // Google's app reviewers cannot receive a real SMS OTP on a Jordanian
    // number. For this ONE dedicated test number we skip sending any SMS and
    // return success; verify-otp accepts a fixed code for the same number.
    // This affects ONLY this number — every real user still goes through the
    // normal CSPRNG OTP + Twilio/Unifonic path with no change.
    const TEST_PHONE = "+962799999999";
    if (toE164(normalizedPhone) === TEST_PHONE) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jordanPattern = /^(\+962|00962|0)?7[789]\d{7}$/;
    if (!jordanPattern.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: "INVALID_JORDAN_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey()
    );

    const { data, error } = await supabase.rpc("send_otp", { p_phone: normalizedPhone });

    if (error) {
      console.error("[send-otp] RPC error:", error);
      return new Response(
        JSON.stringify({ error: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.success) {
      return new Response(
        JSON.stringify({ error: data?.error ?? "FAILED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = data.code as string;
    const smsBody = `رمز التحقق في وسيط: ${code}\nلا تشاركه مع أحد.\nWaseet OTP: ${code}`;
    const e164Phone = toE164(normalizedPhone);

    // ── Provider selection: Twilio → Unifonic → Dev mode ──
    const hasTwilio   = !!Deno.env.get("TWILIO_ACCOUNT_SID");
    const hasUnifonic = !!Deno.env.get("UNIFONIC_APP_SID");
    const isDev       = Deno.env.get("ENVIRONMENT") === "development";

    if (hasTwilio) {
      console.log("[send-otp] Using Twilio");
      const result = await sendViaTwilio(e164Phone, smsBody);
      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: "SMS_SEND_FAILED" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (hasUnifonic) {
      console.log("[send-otp] Using Unifonic");
      const result = await sendViaUnifonic(normalizedPhone, smsBody);
      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: "SMS_SEND_FAILED" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (isDev) {
      console.warn("[send-otp] Dev mode — OTP in response");
      return new Response(
        JSON.stringify({ success: true, dev_code: code }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("[send-otp] No SMS provider configured");
      return new Response(
        JSON.stringify({ error: "SMS_PROVIDER_NOT_CONFIGURED" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-otp] error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
