/**
 * Scenario 04 — Notification Feed
 * Simulates users polling their notification list (happens on every app open).
 * At 100k users this is the highest-frequency read endpoint.
 *
 * Run: k6 run --env SUPABASE_URL=<url> --env BEARER_TOKEN=<jwt> 04_notifications.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate    = new Rate('errors');
const notifLatency = new Trend('notif_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m',  target: 500 },
    { duration: '2m',  target: 1000 }, // notifications are polled very frequently
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    http_req_duration:  ['p(95)<300', 'p(99)<600'],
    errors:             ['rate<0.005'],
    notif_latency:      ['p(95)<300'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL      || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const BEARER   = __ENV.BEARER_TOKEN      || '';

const SEED_USER_IDS = (__ENV.USER_IDS || '').split(',').filter(Boolean);

export default function () {
  const headers = {
    'apikey':        ANON_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Content-Type':  'application/json',
  };

  const userId = SEED_USER_IDS.length
    ? SEED_USER_IDS[Math.floor(Math.random() * SEED_USER_IDS.length)]
    : null;

  const baseUrl = `${BASE_URL}/rest/v1/notifications`;
  const url = userId
    ? `${baseUrl}?select=id,title,body,is_read,created_at,screen,metadata&user_id=eq.${userId}&order=created_at.desc&limit=30`
    : `${baseUrl}?select=id,title,body,is_read,created_at&order=created_at.desc&limit=30`;

  const start = Date.now();
  const res   = http.get(url, { headers, tags: { name: 'notifications' } });
  notifLatency.add(Date.now() - start);

  errorRate.add(!check(res, {
    'status 200':            (r) => r.status === 200,
    'returns array':         (r) => Array.isArray(r.json()),
    'response time < 300ms': (r) => r.timings.duration < 300,
  }));

  sleep(Math.random() * 5 + 5); // 5–10 s polling interval
}
