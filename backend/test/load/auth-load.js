import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const authTrend = new Trend('auth_duration');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    auth_duration: ['p(95)<2000'],
    http_req_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Auth Flow', () => {
    const email = `load-${__VU}-${Date.now()}@test.com`;
    const registerPayload = JSON.stringify({
      email,
      password: 'LoadTest123!',
      name: `Load User ${__VU}`,
      age: 25 + (__VU % 30),
      countryCode: 'US',
      nativeLanguage: 'en',
      learningGoal: 'general',
      dailyStudyMin: 15,
    });

    const registerRes = http.post(`${BASE_URL}/v1/auth/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(registerRes, {
      'register success': (r) => r.status === 201,
    });

    if (registerRes.status !== 201) {
      errorRate.add(1);
      return;
    }

    authTrend.add(registerRes.timings.duration);

    const { accessToken, refreshToken } = registerRes.json();

    sleep(1);

    const loginRes = http.post(
      `${BASE_URL}/v1/auth/login`,
      JSON.stringify({ email, password: 'LoadTest123!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    check(loginRes, {
      'login success': (r) => r.status === 200,
    });

    if (loginRes.status !== 200) {
      errorRate.add(1);
      return;
    }

    sleep(1);

    const profileRes = http.get(`${BASE_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    check(profileRes, {
      'profile fetch success': (r) => r.status === 200,
    });

    const refreshRes = http.post(
      `${BASE_URL}/v1/auth/refresh`,
      JSON.stringify({ refreshToken }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    check(refreshRes, {
      'refresh success': (r) => r.status === 200,
    });
  });

  sleep(2);
}
