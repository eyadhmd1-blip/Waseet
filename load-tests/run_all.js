/**
 * Waseet — Master Load Test (100k-user simulation)
 *
 * Combines all four scenarios into a single k6 run with realistic
 * traffic distribution:
 *   40% — provider feed browsing      (highest volume)
 *   25% — notification polling        (high frequency)
 *   25% — client request + bid views  (medium volume)
 *   10% — bid submissions             (write-heavy, lower volume)
 *
 * Peak load: ~1 000 concurrent VUs ≈ 100k daily active users
 * (10-minute avg session, ~1 req/min per user)
 *
 * Usage:
 *   k6 run \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=eyJ... \
 *     --env BEARER_TOKEN=<valid provider JWT> \
 *     --env REQUEST_IDS=uuid1,uuid2 \
 *     --env PROVIDER_IDS=uuid1,uuid2 \
 *     --env CLIENT_IDS=uuid1,uuid2 \
 *     --env USER_IDS=uuid1,uuid2 \
 *     load-tests/run_all.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Metrics ───────────────────────────────────────────────────
const errors       = new Rate('errors');
const feedLatency  = new Trend('feed_latency',   true);
const bidLatency   = new Trend('bid_latency',    true);
const listLatency  = new Trend('list_latency',   true);
const notifLatency = new Trend('notif_latency',  true);
const bidsOk       = new Counter('bids_accepted');

// ── Options ───────────────────────────────────────────────────
export const options = {
  scenarios: {
    provider_feed: {
      executor: 'ramping-vus',
      exec:     'providerFeed',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50  },
        { duration: '3m',  target: 400 },
        { duration: '5m',  target: 400 },
        { duration: '1m',  target: 0   },
      ],
      gracefulRampDown: '30s',
    },
    notifications: {
      executor: 'ramping-vus',
      exec:     'notifications',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50  },
        { duration: '3m',  target: 250 },
        { duration: '5m',  target: 250 },
        { duration: '1m',  target: 0   },
      ],
      gracefulRampDown: '30s',
    },
    client_requests: {
      executor: 'ramping-vus',
      exec:     'clientRequests',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50  },
        { duration: '3m',  target: 250 },
        { duration: '5m',  target: 250 },
        { duration: '1m',  target: 0   },
      ],
      gracefulRampDown: '30s',
    },
    bid_submission: {
      executor: 'ramping-vus',
      exec:     'bidSubmission',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 10  },
        { duration: '3m',  target: 100 },
        { duration: '5m',  target: 100 },
        { duration: '1m',  target: 0   },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration':                       ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{scenario:provider_feed}':    ['p(95)<500'],
    'http_req_duration{scenario:bid_submission}':   ['p(95)<800'],
    'http_req_duration{scenario:client_requests}':  ['p(95)<600'],
    'http_req_duration{scenario:notifications}':    ['p(95)<300'],
    'errors':              ['rate<0.01'],
    'http_req_failed':     ['rate<0.01'],
    'feed_latency':        ['p(95)<500'],
    'bid_latency':         ['p(95)<800'],
    'list_latency':        ['p(95)<600'],
    'notif_latency':       ['p(95)<300'],
  },
};

// ── Shared helpers ────────────────────────────────────────────
const BASE_URL  = __ENV.SUPABASE_URL       || 'http://localhost:54321';
const ANON_KEY  = __ENV.SUPABASE_ANON_KEY  || '';
const BEARER    = __ENV.BEARER_TOKEN       || ANON_KEY;

function headers() {
  return {
    'apikey':        ANON_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Content-Type':  'application/json',
  };
}

function pick(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

const CITIES     = ['عمان', 'إربد', 'الزرقاء', 'العقبة', 'السلط'];
const CATEGORIES = ['cleaning', 'plumbing', 'electrical', 'painting', 'carpentry'];
const REQ_IDS    = (__ENV.REQUEST_IDS   || '').split(',').filter(Boolean);
const PROV_IDS   = (__ENV.PROVIDER_IDS  || '').split(',').filter(Boolean);
const CLIENT_IDS = (__ENV.CLIENT_IDS    || '').split(',').filter(Boolean);
const USER_IDS   = (__ENV.USER_IDS      || '').split(',').filter(Boolean);

// ── Scenario 1: Provider Feed ─────────────────────────────────
export function providerFeed() {
  const city     = pick(CITIES);
  const category = pick(CATEGORIES);

  const url = `${BASE_URL}/rest/v1/requests` +
    `?select=id,title,city,category_slug,urgency_level,created_at,budget_min,budget_max` +
    `&status=eq.open` +
    `&city=eq.${encodeURIComponent(city)}` +
    `&category_slug=eq.${category}` +
    `&order=created_at.desc` +
    `&limit=20`;

  const t   = Date.now();
  const res = http.get(url, { headers: headers(), tags: { scenario: 'provider_feed' } });
  feedLatency.add(Date.now() - t);

  errors.add(!check(res, {
    'feed: status 200':  (r) => r.status === 200,
    'feed: < 500ms':     (r) => r.timings.duration < 500,
    'feed: is array':    (r) => Array.isArray(r.json()),
  }));

  sleep(Math.random() * 2 + 1);
}

// ── Scenario 2: Bid Submission ────────────────────────────────
export function bidSubmission() {
  if (!REQ_IDS.length || !PROV_IDS.length) { sleep(2); return; }

  const body = JSON.stringify({
    p_request_id:  pick(REQ_IDS),
    p_provider_id: pick(PROV_IDS),
    p_amount:      Math.floor(Math.random() * 90 + 10),
    p_note:        'اختبار حمل',
    p_credit_cost: Math.random() < 0.3 ? 2 : 1,
  });

  const t   = Date.now();
  const res = http.post(
    `${BASE_URL}/rest/v1/rpc/submit_bid_with_credits`,
    body,
    { headers: headers(), tags: { scenario: 'bid_submission' } }
  );
  bidLatency.add(Date.now() - t);

  const ok = check(res, {
    'bid: status 200': (r) => r.status === 200,
    'bid: < 800ms':    (r) => r.timings.duration < 800,
  });

  if (res.status === 200 && res.json()?.bid_id) bidsOk.add(1);
  errors.add(!ok);

  sleep(Math.random() * 3 + 2);
}

// ── Scenario 3: Client Requests + Bid List ────────────────────
export function clientRequests() {
  const h = headers();

  group('requests_list', () => {
    const clientId = pick(CLIENT_IDS);
    const url = clientId
      ? `${BASE_URL}/rest/v1/requests?select=id,title,status,created_at&client_id=eq.${clientId}&order=created_at.desc&limit=20`
      : `${BASE_URL}/rest/v1/requests?select=id,title,status,created_at&status=eq.open&order=created_at.desc&limit=20`;

    const t   = Date.now();
    const res = http.get(url, { headers: h, tags: { scenario: 'client_requests' } });
    listLatency.add(Date.now() - t);

    errors.add(!check(res, {
      'list: status 200': (r) => r.status === 200,
      'list: < 600ms':    (r) => r.timings.duration < 600,
    }));
  });

  sleep(0.5);

  group('bids_for_request', () => {
    if (!REQ_IDS.length) return;
    const url = `${BASE_URL}/rest/v1/bids` +
      `?select=id,amount,note,status,provider_id&request_id=eq.${pick(REQ_IDS)}&order=amount.asc&limit=10`;

    const res = http.get(url, { headers: h, tags: { scenario: 'client_requests' } });
    errors.add(!check(res, { 'bids: status 200': (r) => r.status === 200 }));
  });

  sleep(Math.random() * 2 + 1);
}

// ── Scenario 4: Notifications ─────────────────────────────────
export function notifications() {
  const userId = pick(USER_IDS);
  const url = userId
    ? `${BASE_URL}/rest/v1/notifications?select=id,title,body,is_read,created_at&user_id=eq.${userId}&order=created_at.desc&limit=30`
    : `${BASE_URL}/rest/v1/notifications?select=id,title,is_read,created_at&order=created_at.desc&limit=30`;

  const t   = Date.now();
  const res = http.get(url, { headers: headers(), tags: { scenario: 'notifications' } });
  notifLatency.add(Date.now() - t);

  errors.add(!check(res, {
    'notif: status 200': (r) => r.status === 200,
    'notif: < 300ms':    (r) => r.timings.duration < 300,
  }));

  sleep(Math.random() * 5 + 5);
}
