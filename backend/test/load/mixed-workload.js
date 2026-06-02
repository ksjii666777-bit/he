import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.10'],
    http_req_duration: ['p(95)<4000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIOS = [
  'ordering-food', 'introducing-self', 'asking-directions',
  'shopping', 'small-talk',
];

export function setup() {
  const email = `mixed-${Date.now()}@test.com`;
  const res = http.post(
    `${BASE_URL}/v1/auth/register`,
    JSON.stringify({
      email,
      password: 'Mixed123!',
      name: 'Mixed Test',
      age: 30,
      countryCode: 'GB',
      nativeLanguage: 'fr',
      learningGoal: 'conversation',
      dailyStudyMin: 20,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  const token = data.token;

  group('Placement + Roadmap', () => {
    const placeRes = http.get(`${BASE_URL}/learning/placement/generate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(placeRes, {
      'placement generated': (r) => r.status === 200,
    });

    if (placeRes.status === 200) {
      const questions = placeRes.json();
      const answers = questions.slice(0, 10).map((q) => ({
        questionId: q.id,
        selectedIndex: q.correctIndex,
      }));

      http.post(`${BASE_URL}/learning/placement/evaluate`,
        JSON.stringify({ answers }),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
      );
    }
  });

  sleep(1);

  group('Vocabulary Review', () => {
    const reviewRes = http.get(`${BASE_URL}/vocabulary/review`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(reviewRes, {
      'vocab review fetched': (r) => r.status === 200,
    });

    http.post(`${BASE_URL}/vocabulary/review`,
      JSON.stringify({ word: 'practice', quality: Math.floor(Math.random() * 3) + 3 }),
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    );

    http.get(`${BASE_URL}/vocabulary/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  sleep(1);

  group('Progress', () => {
    const progRes = http.get(`${BASE_URL}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(progRes, {
      'progress fetched': (r) => r.status === 200,
    });

    http.get(`${BASE_URL}/progress/streak`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    http.get(`${BASE_URL}/progress/daily`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  sleep(2);
}
