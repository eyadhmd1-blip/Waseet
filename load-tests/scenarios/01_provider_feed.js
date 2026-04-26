/**
 * Scenario 01 — Provider Feed
 * Simulates providers browsing the open requests list.
 * This is the highest-frequency read path in the app.
 *
 * Run: k6 run --env SUPABASE_URL=<url> --env SUPABASE_ANON_KEY=<key> --env BEARER_TOKEN=<jwt> 01_provider_feed.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate   = new Rate('errors');
const feedLatency = new Trend('feed_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 50  },   // warm-up
    { duration: '1m',  target: 200 },   // ramp to 200 VUs
    { duration: '2m',  target: 500 },   // sustained 500 VUs (peak)
    { duration: '30s', target: 0   },   // cool-down
  ],
  thresholds: {
    http_req_duration:            ['p(95)<500', 'p(99)<1000'],
    errors:                       ['rate<0.01'],
    feed_latency:                 ['p(95)<500'],
  },
};

const BASE_URL   = __ENV.SUPABASE_URL   || 'http://localhost:54321';
const ANON_KEY   = __ENV.SUPABASE_ANON_KEY || '';
const BEARER     = __ENV.BEARER_TOKEN   || ANON_KEY;

const CITIES      = ['عمان', 'إربد', 'الزرقاء', 'العقبة', 'السلط'];
const CATEGORIES  = ['cleaning', 'plumbing', 'electrical', 'painting', 'carpentry'];

export default function () {
  const city     = CITIES[Math.floor(Math.random() * CITIES.length)];
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const url = `${BASE_URL}/rest/v1/requests` +
    `?select=id,title,description,city,category_slug,urgency_level,created_at,budget_min,budget_max` +
    `&status=eq.open` +
    `&city=eq.${encodeURIComponent(city)}` +
    `&category_slug=eq.${category}` +
    `&order=created_at.desc` +
    `&limit=20`;

  const headers = {
    'apikey':        ANON_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Content-Type':  'application/json',
  };

  const start = Date.now();
  const res   = http.get(url, { headers, tags: { name: 'provider_feed' } });
  feedLatency.add(Date.now() - start);

  const ok = check(res, {
    'status 200':           (r) => r.status === 200,
    'returns array':        (r) => r.json() !== null && Array.isArray(r.json()),
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);
  sleep(Math.random() * 2 + 1); // 1–3 s think time
}
