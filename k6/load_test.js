// Waseet — k6 Load Test
// Tests core Supabase REST API endpoints under ramping concurrent users.
// Run: k6 run k6/load_test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = 'https://bkbjsstxhvdnqcmpuulf.supabase.co';
const ANON_KEY  = 'sb_publishable_lKYwWidN9UNk3ncxGoJq0Q_zCo5-nyQ';

const errorRate    = new Rate('error_rate');
const requestsLat  = new Trend('requests_latency',  true);
const providersLat = new Trend('providers_latency', true);
const categoriesLat = new Trend('categories_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 50  },  // ramp up to 50 VUs
    { duration: '60s', target: 150 },  // ramp up to 150 VUs
    { duration: '60s', target: 300 },  // ramp up to 300 VUs
    { duration: '30s', target: 0   },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],    // error rate < 1%
    http_req_duration: ['p(95)<2000'],   // 95th pct < 2s (free-tier staging; production Pro target: 500ms)
    error_rate:        ['rate<0.01'],
  },
};

const HEADERS = {
  'apikey':        ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type':  'application/json',
};

export default function () {
  // 1. Fetch open service requests (main client feed)
  const reqRes = http.get(
    `${BASE_URL}/rest/v1/requests?select=id,title,category_slug,city,status&status=eq.open&order=created_at.desc&limit=20`,
    { headers: HEADERS }
  );
  requestsLat.add(reqRes.timings.duration);
  const reqOk = check(reqRes, {
    'requests 200': (r) => r.status === 200,
  });
  errorRate.add(!reqOk);

  sleep(0.5);

  // 2. Fetch providers list
  const provRes = http.get(
    `${BASE_URL}/rest/v1/users?select=id,full_name,city,role&role=eq.provider&limit=20`,
    { headers: HEADERS }
  );
  providersLat.add(provRes.timings.duration);
  const provOk = check(provRes, {
    'providers 200': (r) => r.status === 200,
  });
  errorRate.add(!provOk);

  sleep(0.5);

  // 3. Fetch categories (used on every new-request screen open)
  const catRes = http.get(
    `${BASE_URL}/rest/v1/service_categories?select=id,name_ar,name_en&order=sort_order`,
    { headers: HEADERS }
  );
  categoriesLat.add(catRes.timings.duration);
  const catOk = check(catRes, {
    'categories 200': (r) => r.status === 200,
  });
  errorRate.add(!catOk);

  sleep(1);
}
