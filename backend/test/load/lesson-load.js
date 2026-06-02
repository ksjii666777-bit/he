import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  const email = `lesson-load-setup@test.com`;
  const res = http.post(
    `${BASE_URL}/v1/auth/register`,
    JSON.stringify({
      email,
      password: 'SetupPass123!',
      name: 'Setup User',
      age: 25,
      countryCode: 'US',
      nativeLanguage: 'en',
      learningGoal: 'general',
      dailyStudyMin: 15,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  group('Lesson Generation', () => {
    const genRes = http.post(
      `${BASE_URL}/learning/lesson/generate`,
      null,
      { headers: { Authorization: `Bearer ${data.token}` } },
    );

    check(genRes, {
      'lesson generated': (r) => r.status === 201,
      'lesson has exercises': (r) => r.json('content.exercises.length') >= 4,
    });

    if (genRes.status !== 201) {
      errorRate.add(1);
      return;
    }

    const lessonId = genRes.json('id');
    const exercises = genRes.json('content.exercises') || [];

    sleep(1);

    const mcqExercises = exercises.filter((e) => e.correctIndex !== undefined);
    if (mcqExercises.length > 0) {
      const ex = mcqExercises[0];
      const checkRes = http.post(
        `${BASE_URL}/learning/lesson/${lessonId}/check`,
        JSON.stringify({ exerciseId: ex.id, userAnswer: ex.correctIndex.toString() }),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` } },
      );

      check(checkRes, {
        'answer checked': (r) => r.status === 201,
      });
    }

    sleep(1);

    const answers = mcqExercises.map((e) => ({
      exerciseId: e.id,
      userAnswer: e.correctIndex?.toString() || '0',
    }));

    if (answers.length > 0) {
      const submitRes = http.post(
        `${BASE_URL}/learning/lesson/${lessonId}/submit`,
        JSON.stringify({ answers }),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` } },
      );

      check(submitRes, {
        'lesson submitted': (r) => r.status === 201,
        'has results': (r) => r.json('results') !== undefined,
      });
    }
  });

  sleep(3);
}
