// Supabase Edge Function — send-otp
// Deno runtime
// Sends an OTP SMS via Unifonic to verify a phone number.
//
// ENV vars required (set in Supabase Dashboard → Edge Functions → Secrets):
//   UNIFONIC_APP_SID   — Unifonic application SID / API key
//   SUPABASE_URL       — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// Request body: { phone: string }  — E.164 format e.g. "00962791234567" or "+962791234567"
// Response:     { success: true } | { error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Normalize: strip spaces, ensure starts with 00962 or +962
    const normalizedPhone = phone.trim().replace(/\s+/g, "");

    // Basic Jordanian phone validation
    const jordanPattern = /^(\+962|00962|0)?7[789]\d{7}$/;
    if (!jordanPattern.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: "INVALID_JORDAN_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize to 00962 format for Unifonic
    let unifonicPhone = normalizedPhone;
    if (unifonicPhone.startsWith("+962")) {
      unifonicPhone = "00962" + unifonicPhone.slice(4);
    } else if (unifonicPhone.startsWith("0") && !unifonicPhone.startsWith("00")) {
      unifonicPhone = "00962" + unifonicPhone.slice(1);
    } else if (/^7[789]/.test(unifonicPhone)) {
      unifonicPhone = "00962" + unifonicPhone;
    }

    // Create Supabase admin client to call send_otp RPC
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Call DB function to generate OTP code
    const { data, error } = await supabase.rpc("send_otp", { p_phone: normalizedPhone });

    if (error) {
      console.error("send_otp RPC error:", error);
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

    // Send SMS via Unifonic REST API
    const appSid = Deno.env.get("UNIFONIC_APP_SID");

    if (!appSid) {
      // BUG-001 FIX: Only expose dev_code when explicitly running in development
      // environment. A missing AppSid in staging/production must be a hard error,
      // not a silent bypass that exposes the OTP in the HTTP response.
      const isDev = Deno.env.get("ENVIRONMENT") === "development";
      if (isDev) {
        console.warn("[send-otp] Dev mode — OTP returned in response (ENVIRONMENT=development)");
        return new Response(
          JSON.stringify({ success: true, dev_code: code }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("[send-otp] UNIFONIC_APP_SID is not configured in this environment");
      return new Response(
        JSON.stringify({ error: "SMS_PROVIDER_NOT_CONFIGURED" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsBody = `رمز التحقق الخاص بك في وسيط هو: ${code}\nلا تشاركه مع أحد.\nYour Waseet OTP: ${code}`;

    const formData = new URLSearchParams({
      AppSid:      appSid,
      Recipient:   unifonicPhone,
      Body:        smsBody,
      SenderID:    "Waseet",
      responseType: "JSON",
    });

    const smsResponse = await fetch(
      "https://el.cloud.unifonic.com/rest/SMS/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );

    const smsResult = await smsResponse.json();

    if (!smsResponse.ok || smsResult?.Success === false) {
      console.error("Unifonic SMS failed:", smsResult);
      return new Response(
        JSON.stringify({ error: "SMS_SEND_FAILED" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
