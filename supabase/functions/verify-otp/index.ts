// Supabase Edge Function — verify-otp
// Deno runtime
// Verifies the OTP entered by the user, marks phone as verified.
//
// When called with create_session=true (login flow):
//   - Creates or resolves the Supabase auth user for this phone
//   - Generates a magic-link token the client can exchange for a real session
//   - Returns: { success: true, token_hash: string, is_new_user: boolean }
//
// When called without create_session (verify-phone flow, already authenticated):
//   - Only verifies the code; returns { success: true }
//
// ENV vars required:
//   SUPABASE_URL                — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected
//
// Request body: { phone: string, code: string, create_session?: boolean }
// Response:     { success: true, token_hash?: string, is_new_user?: boolean }
//             | { error: string }

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
    const body = await req.json();
    const { phone, code, create_session = false } = body as {
      phone: string;
      code: string;
      create_session?: boolean;
    };

    if (!phone || !code || typeof phone !== "string" || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Step 1: Verify OTP via DB RPC ──────────────────────────────────────
    const { data: otpResult, error: otpError } = await supabase.rpc("verify_otp", {
      p_phone: phone.trim(),
      p_code: code.trim(),
    });

    if (otpError) {
      console.error("verify_otp RPC error:", otpError);
      return new Response(
        JSON.stringify({ error: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpResult?.success) {
      const errCode = otpResult?.error ?? "VERIFICATION_FAILED";
      const statusCode = errCode === "MAX_ATTEMPTS" ? 429 : 400;
      return new Response(
        JSON.stringify({ error: errCode }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Simple path: verify-phone flow (user is already authenticated) ─────
    if (!create_session) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Resolve / create the Supabase auth user for this phone ─────
    //
    // We use a deterministic synthetic email as a stable auth identifier for
    // phone-only users.  Format: p{E164-digits}@waseet.internal
    // e.g.  +96279000001  →  p96279000001@waseet.internal
    //
    const cleanPhone = phone.trim().replace(/^\+/, "");
    const syntheticEmail = `p${cleanPhone}@waseet.internal`;

    let isNewUser = false;

    // 2a. Check our application users table first (fastest path for existing users)
    const { data: appUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (appUser?.id) {
      // Existing registered user — ensure their auth record has the synthetic email
      // so generateLink works correctly.
      const { data: authUser } = await supabase.auth.admin.getUserById(appUser.id as string);
      if (authUser?.user && authUser.user.email !== syntheticEmail) {
        await supabase.auth.admin.updateUserById(appUser.id as string, {
          email: syntheticEmail,
          email_confirm: true,
          phone_confirm: true,
        });
      }
    } else {
      // 2b. New user or incomplete onboarding — try to create the auth user
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        phone: phone.trim(),
        phone_confirm: true,
        user_metadata: { phone: phone.trim() },
      });

      if (createData?.user) {
        // Successfully created — this is a brand-new user
        isNewUser = true;
      } else {
        // Auth user already exists but has no application users row yet
        // (e.g. previous login attempt that didn't complete onboarding).
        // Scan auth users to find them — acceptable for a small staging user base.
        console.warn("createUser failed, searching existing auth users:", createError?.message);

        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({
          perPage: 1000,
          page: 1,
        });

        const found = authUsers?.find(
          (u) => u.phone === phone.trim() || u.email === syntheticEmail
        );

        if (found) {
          // Update their email to the synthetic one if it differs
          if (found.email !== syntheticEmail) {
            await supabase.auth.admin.updateUserById(found.id, {
              email: syntheticEmail,
              email_confirm: true,
            });
          }
        } else {
          console.error("Cannot resolve auth user for phone:", phone, createError);
          return new Response(
            JSON.stringify({ error: "USER_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── Step 3: Generate a magic-link token for the client to open a session ─
    //
    // generateLink() creates a signed token in the DB and returns it.
    // The client calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
    // to exchange it for a real access_token / refresh_token pair.
    //
    // Note: Supabase may attempt to send an email to syntheticEmail.  Since
    // @waseet.internal is not a real domain the email will silently bounce;
    // the link data is still returned successfully regardless.
    //
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("generateLink error:", linkError);
      return new Response(
        JSON.stringify({ error: "SESSION_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_hash: linkData.properties.hashed_token,
        is_new_user: isNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("verify-otp error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
