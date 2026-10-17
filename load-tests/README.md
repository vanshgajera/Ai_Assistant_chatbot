# k6 Load Testing Guide

Ye guide k6 ko use karke API par **Load Testing** perform karne ke liye hai.

---

## 1. Prerequisites
- **k6** installed hona chahiye (`k6 version`).
- Server chalu hona chahiye (`http://localhost:5000`).

---

## 2. Test Script: `load_test.js`

Yeh single load test script hai jisme aap 50 VUs (100 seconds) ya custom load test chala sakte hain:

```bash
# Default run (50 VUs for 100 seconds):
npm run test:load

# Ya direct k6 command:
k6 run load-tests/load_test.js

# Custom VUs aur Duration ke saath:
k6 run load-tests/load_test.js -e VUS=20 -e DURATION=30s
```

---

## 3. Key Metrics

- `http_reqs`: Total kitne HTTP requests bheje gaye aur RPS (requests per second).
- `http_req_duration`: Response time latency (`avg`, `p(90)`, `p(95)` < 250ms).
- `http_req_failed`: Failed requests rate (`0.00%` hona chahiye).
- `checks_succeeded`: Health checks aur status 200 pass rate.
