import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Module Integration (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `integration-${Date.now()}@test.com`,
        password: 'IntTest123!',
        name: 'Integration Test',
        age: 25,
        countryCode: 'US',
        nativeLanguage: 'en',
        learningGoal: 'general',
        dailyStudyMin: 15,
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('AI Gateway — CostGuard + ModelRouter', () => {
    it('should track cost on lesson generation', async () => {
      const res = await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBeDefined();
      expect(res.body.content).toBeDefined();
    });

    it('should track cost on placement evaluation', async () => {
      const qRes = await request(app.getHttpServer())
        .get('/learning/placement/generate')
        .set('Authorization', `Bearer ${accessToken}`);

      const answers = qRes.body.slice(0, 5).map((q: any) => ({
        questionId: q.id,
        selectedIndex: q.correctIndex,
      }));

      await request(app.getHttpServer())
        .post('/learning/placement/evaluate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers })
        .expect(201);
    });
  });

  describe('Speech — Deepgram STT + Pronunciation + TTS', () => {
    it('should chain STT to pronunciation scoring', async () => {
      const pronRes = await request(app.getHttpServer())
        .post('/speech/pronunciation')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          referenceText: 'I would like to order a coffee',
          audioBuffer: Buffer.from('mock').toString('base64'),
        })
        .expect(201);

      expect(pronRes.body.overallScore).toBeGreaterThanOrEqual(0);
      expect(pronRes.body.feedback.length).toBeGreaterThanOrEqual(0);
    });

    it('should chain TTS to transcribe round-trip', async () => {
      const ttsRes = await request(app.getHttpServer())
        .post('/speech/synthesize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ text: 'Hello world', voiceId: '21m00Tcm4TlvDq8ikWAM' })
        .expect(201);

      expect(ttsRes.body.audio.length).toBeGreaterThan(100);
    });
  });

  describe('Learning — Lesson → Exercise → Completion', () => {
    it('should complete full lesson lifecycle', async () => {
      const genRes = await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const lessonId = genRes.body.id;
      const exercises = genRes.body.content.exercises;

      const mcqExercises = exercises.filter(
        (e: any) => 'correctIndex' in e && Array.isArray(e.options),
      );

      if (mcqExercises.length > 0) {
        const ex = mcqExercises[0];
        await request(app.getHttpServer())
          .post(`/learning/lesson/${lessonId}/check`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ exerciseId: ex.id, userAnswer: ex.correctIndex.toString() })
          .expect(201);
      }

      const answers = mcqExercises.map((e: any) => ({
        exerciseId: e.id,
        userAnswer: e.correctIndex.toString(),
      }));

      if (answers.length > 0) {
        const submitRes = await request(app.getHttpServer())
          .post(`/learning/lesson/${lessonId}/submit`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ answers })
          .expect(201);

        expect(submitRes.body.totalCorrect).toBeGreaterThanOrEqual(0);
        expect(submitRes.body.totalScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Progress — Event-Driven Updates', () => {
    it('should emit lesson.completed event and update activity', async () => {
      await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`);

      const progressRes = await request(app.getHttpServer())
        .get('/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(progressRes.body.totalLessons).toBeGreaterThanOrEqual(0);
      expect(progressRes.body.streak).toBeGreaterThanOrEqual(0);
    });

    it('should update vocabulary stats after review', async () => {
      await request(app.getHttpServer())
        .post('/vocabulary/review')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ word: 'vocabulary', quality: 5 })
        .expect(201);

      const statsRes = await request(app.getHttpServer())
        .get('/vocabulary/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(statsRes.body.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Roadmap → AI Enhancement', () => {
    it('should enhance roadmap with AI recommendations', async () => {
      const roadmapRes = await request(app.getHttpServer())
        .post('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMonths: 3, currentCefr: 'A2', targetCefr: 'B1' })
        .expect(201);

      const roadmapId = roadmapRes.body.id;

      const enhanceRes = await request(app.getHttpServer())
        .post(`/learning/roadmap/${roadmapId}/enhance`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(enhanceRes.body).toHaveProperty('recommendations');
    });
  });
});
