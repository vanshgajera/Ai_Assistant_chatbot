import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom Metrics
const responseTimeTrend = new Trend('custom_req_duration');
const successfulRequests = new Counter('custom_200_count');

// Test Configuration
// Default: 50 Virtual Users for 100s. Can override via CLI: k6 run load_test.js -e VUS=20 -e DURATION=30s
export const options = {
  vus: Number(__ENV.VUS) || 50,
  duration: __ENV.DURATION || '100s',

  thresholds: {
    http_req_failed: ['rate<0.05'],    // 5% se kam failure rate (safe buffer)
    http_req_duration: ['p(95)<500'],  // 95% requests 500ms ke andar
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000';

// Test shuru hone se pehle check karo ki server chal raha hai ya nahi
export function setup() {
  const res = http.get(`${BASE_URL}/api/health`, { timeout: '3s' });
  if (res.status !== 200) {
    throw new Error(
      `\n\n=================================================================\n` +
      `❌ SERVER CONNECT NAHI HO PAYA (${BASE_URL}/api/health)!\n` +
      `👉 Pehle server start karein: 'npm --prefix server run dev' ya 'npm run dev'\n` +
      `=================================================================\n`
    );
  }
  return { ok: true };
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  responseTimeTrend.add(res.timings.duration);
  if (res.status === 200) {
    successfulRequests.add(1);
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has primary model': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body && body.primary);
      } catch (e) {
        return false;
      }
    },
    'latency below 250ms': (r) => r.timings.duration < 250,
  });

  sleep(0.1);
}
