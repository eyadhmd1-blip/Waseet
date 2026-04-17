// ============================================================
// WASEET — Notification Dispatcher
// Supabase Edge Function (Deno runtime)
//
// This function replaces the direct cron → notification-engine
// pattern at scale. It is the ONLY function wired to the daily
// cron job. It then fans out N parallel notification-engine
// invocations in waves of CONCURRENCY, each covering a batch
// of BATCH_SIZE users.
//
// Architecture at 1M users:
//
//   pg_cron (06:00 UTC daily)
//     └─► notification-dispatcher
//           ├─► notification-engine { offset:    0, size: 500 }
//           ├─► notification-engine { offset:  500, size: 500 }
//           ├─► notification-engine { offset: 1000, size: 500 }
//           └─► … (2000 parallel workers for 1M users)
//
// Concurrency is capped at CONCURRENCY (default 10) to avoid
// thundering-herd on Supabase edge runtime.
// Each wave of 10 batches = 5,000 users, ~1–2 sec per wave.
// 1M users → 200 waves → ~3–6 minutes total, well within
// the 06:00–09:00 UTC quiet window.
//
// ENV vars (all auto-injected by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Manual trigger:
//   curl -X POST https://<project>.supabase.co/functions/v1/notification-dispatcher \
//     -H "Authorization: Bearer <service_role_key>" \
//     -d '{ "dry_run": true }'
//
// Cron expression: 0 6 * * * (06:00 UTC = 09:00 Jordan/UTC+3)
// Register via:
//   supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Config ───────────────────────────────────────────────────

const BATCH_SIZE  = 500;  // users per notification-engine invocation
const CONCURRENCY = 10;   // max simultaneous engine invocations per wave

// ─── Handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  let dryRun = false;
  let useAI  = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun     = body.dry_run === true;
    useAI      = body.use_ai  === true;
  } catch { /* no body */ }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── Count eligible users in the cache ──────────────────────
  // We count the materialised cache table — instant, indexed.
  const { count: totalUsers, error: countErr } = await supabase
    .from("user_segments_cache")
    .select("user_id", { count: "exact", head: true });

  if (countErr) {
    console.error("[Dispatcher] Count error:", countErr);
    return json({ error: countErr.message }, 500);
  }

  const total      = totalUsers ?? 0;
  const numBatches = Math.ceil(total / BATCH_SIZE);

  console.log(
    `[Dispatcher] total=${total} batches=${numBatches} ` +
    `batchSize=${BATCH_SIZE} concurrency=${CONCURRENCY} dryRun=${dryRun}`,
  );

  if (numBatches === 0) {
    return json({ ok: true, total_users: 0, num_batches: 0 });
  }

  const engineUrl  = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notification-engine`;
  const authHeader = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

  // ── Fan-out in waves ────────────────────────────────────────
  // Each wave fires CONCURRENCY batches concurrently, then
  // waits for all of them before starting the next wave.
  // This prevents overwhelming the edge runtime while still
  // achieving high throughput.
  const dispatchAll = async () => {
    let waveIndex = 0;
    const results: { batch: number; ok: boolean }[] = [];

    for (let batchStart = 0; batchStart < numBatches; batchStart += CONCURRENCY) {
      const waveEnd = Math.min(batchStart + CONCURRENCY, numBatches);
      const waveFetches: Promise<void>[] = [];

      for (let b = batchStart; b < waveEnd; b++) {
        const offset = b * BATCH_SIZE;
        const fetchP = fetch(engineUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            batch_offset: offset,
            batch_size:   BATCH_SIZE,
            dry_run:      dryRun,
            use_ai:       useAI,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const text = await res.text().catch(() => "");
              console.error(`[Dispatcher] batch ${b} HTTP ${res.status}: ${text}`);
              results.push({ batch: b, ok: false });
            } else {
              results.push({ batch: b, ok: true });
            }
          })
          .catch((err) => {
            console.error(`[Dispatcher] batch ${b} fetch error:`, err);
            results.push({ batch: b, ok: false });
          });

        waveFetches.push(fetchP);
      }

      // Wait for the entire wave before dispatching the next
      await Promise.allSettled(waveFetches);
      waveIndex++;
      console.log(
        `[Dispatcher] wave ${waveIndex} done ` +
        `(batches ${batchStart}–${waveEnd - 1} of ${numBatches})`,
      );
    }

    const failed = results.filter((r) => !r.ok).length;
    console.log(
      `[Dispatcher] complete. ${results.length - failed}/${results.length} batches succeeded.`,
    );
  };

  // Fire dispatch in the background so this function returns
  // immediately, avoiding gateway timeouts on large user bases.
  // EdgeRuntime.waitUntil keeps the Deno isolate alive until
  // all wave promises resolve.
  // @ts-ignore — EdgeRuntime is available in Supabase Deno runtime
  EdgeRuntime.waitUntil(dispatchAll());

  return json({
    ok:          true,
    total_users: total,
    num_batches: numBatches,
    batch_size:  BATCH_SIZE,
    concurrency: CONCURRENCY,
    dry_run:     dryRun,
  });
});
