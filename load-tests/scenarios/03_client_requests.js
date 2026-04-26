/**
 * Scenario 03 — Client Request List + Bid Read
 * Simulates clients viewing their requests and the bids on each.
 *
 * Run: k6 run --env SUPABASE_URL=<url> --env BEARER_TOKEN=<jwt> 03_client_requests.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate      = new Rate('errors');
const listLatency    = new Trend('requests_list_latency', true);
const detailLatency  = new Trend('request_detail_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 50  },
    { duration: '1m',  target: 250 },
    { duration: '2m',  target: 400 },
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    http_req_duration:      ['p(95)<600'],
    errors:                 ['rate<0.01'],
    requests_list_latency:  ['p(95)<400'],
    request_detail_latency: ['p(95)<600'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL      || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const BEARER   = __ENV.BEARER_TOKEN      || ''; // must be a real user JWT

const SEED_CLIENT_IDS  = (__ENV.CLIENT_IDS  || '').split(',').filter(Boolean);
const SEED_REQUEST_IDS = (__ENV.REQUEST_IDS || '').split(',').filter(Boolean);

export default function () {
  const headers = {
    'apikey':       ANON_KEY,
    'Content-Type': 'application/json',
    ...(BEARER ? { 'Authorization': `Bearer ${BEARER}` } : {}),
  };

  // ── Step 1: List client's requests ──────────────────────────
  group('list_requests', () => {
    const clientId = SEED_CLIENT_IDS.length
      ? SEED_CLIENT_IDS[Math.floor(Math.random() * SEED_CLIENT_IDS.length)]
      : null;

    const url = clientId
      ? `${BASE_URL}/rest/v1/requests?select=id,title,status,created_at,urgency_level&client_id=eq.${clientId}&order=created_at.desc&limit=20`
      : `${BASE_URL}/rest/v1/requests?select=id,title,status,created_at&status=eq.open&order=created_at.desc&limit=20`;

    const start = Date.now();
    const res   = http.get(url, { headers, tags: { name: 'client_requests_list' } });
    listLatency.add(Date.now() - start);

    errorRate.add(!check(res, {
      'status 200':            (r) => r.status === 200,
      'returns array':         (r) => Array.isArray(r.json()),
      'response time < 400ms': (r) => r.timings.duration < 400,
    }));
  });

  sleep(0.5);

  // ── Step 2: Open a specific request + read its bids ─────────
  group('request_detail_with_bids', () => {
    if (!SEED_REQUEST_IDS.length) return;

    const requestId = SEED_REQUEST_IDS[Math.floor(Math.random() * SEED_REQUEST_IDS.length)];
    const url = `${BASE_URL}/rest/v1/bids` +
      `?select=id,amount,note,status,created_at,provider_id,credit_cost` +
      `&request_id=eq.${requestId}` +
      `&order=amount.asc` +
      `&limit=10`;

    const start = Date.now();
    const res   = http.get(url, { headers, tags: { name: 'request_bids' } });
    detailLatency.add(Date.now() - start);

    errorRate.add(!check(res, {
      'status 200':            (r) => r.status === 200,
      'response time < 600ms': (r) => r.timings.duration < 600,
    }));
  });

  sleep(Math.random() * 2 + 1);
}
