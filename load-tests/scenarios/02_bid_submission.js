/**
 * Scenario 02 — Bid Submission (RPC)
 * Simulates providers submitting bids via submit_bid_with_credits RPC.
 * This is the most write-heavy critical path.
 *
 * Run: k6 run --env SUPABASE_URL=<url> --env BEARER_TOKEN=<jwt> 02_bid_submission.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate    = new Rate('errors');
const bidLatency   = new Trend('bid_latency', true);
const bidsOk       = new Counter('bids_accepted');
const bidsRejected = new Counter('bids_rejected_business');

export const options = {
  stages: [
    { duration: '30s', target: 20  },
    { duration: '1m',  target: 100 },
    { duration: '2m',  target: 200 },
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    http_req_duration:  ['p(95)<800', 'p(99)<1500'],
    errors:             ['rate<0.01'],
    bid_latency:        ['p(95)<800'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL     || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const BEARER   = __ENV.BEARER_TOKEN     || '';

// These should be pre-seeded request IDs from your staging environment.
// Replace with real UUIDs before running against staging/prod.
const SEED_REQUEST_IDS = (__ENV.REQUEST_IDS || '').split(',').filter(Boolean);
const SEED_PROVIDER_IDS = (__ENV.PROVIDER_IDS || '').split(',').filter(Boolean);

export default function () {
  if (!SEED_REQUEST_IDS.length || !SEED_PROVIDER_IDS.length) {
    // Skip if no seed data provided — don't fail the run
    sleep(1);
    return;
  }

  const requestId  = SEED_REQUEST_IDS[Math.floor(Math.random() * SEED_REQUEST_IDS.length)];
  const providerId = SEED_PROVIDER_IDS[Math.floor(Math.random() * SEED_PROVIDER_IDS.length)];
  const amount     = Math.floor(Math.random() * 90 + 10); // 10–100 JOD
  const creditCost = Math.random() < 0.3 ? 2 : 1;        // 30% urgent bids

  const headers = {
    'apikey':        ANON_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  const body = JSON.stringify({
    p_request_id:  requestId,
    p_provider_id: providerId,
    p_amount:      amount,
    p_note:        'عرض تجريبي من اختبار الحمل',
    p_credit_cost: creditCost,
  });

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/rest/v1/rpc/submit_bid_with_credits`, body, {
    headers,
    tags: { name: 'bid_submission' },
  });
  bidLatency.add(Date.now() - start);

  const ok = check(res, {
    'status 200':           (r) => r.status === 200,
    'response time < 800ms': (r) => r.timings.duration < 800,
  });

  if (res.status === 200) {
    const json = res.json();
    if (json && json.bid_id) {
      bidsOk.add(1);
    } else if (json && (json.code === 'NO_CREDITS' || json.code === 'COOLDOWN_ACTIVE' || json.code === 'MAX_ACTIVE_BIDS')) {
      bidsRejected.add(1); // business-rule rejection, not an error
    } else {
      errorRate.add(1);
    }
  } else {
    errorRate.add(!ok);
  }

  sleep(Math.random() * 3 + 2); // 2–5 s think time between bids
}
