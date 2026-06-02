import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { io as SocketIOClient } from 'socket.io-client';
import { AppModule } from '../../src/app.module';

const TEST_USER = {
  email: `journey-${Date.now()}@test.com`,
  password: 'JourneyTest123!',
  name: 'Journey Test User',
  age: 28,
  countryCode: 'IN',
  nativeLanguage: 'hi',
  learningGoal: 'conversation',
  dailyStudyMin: 20,
};

describe('Full User Journey (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let sessionCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Register', () => {
    it('should register a new user with full profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.profile).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;

      const tokenPayload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(tokenPayload.sub).toBeDefined();
      expect(tokenPayload.email).toBe(TEST_USER.email);
    });

    it('should reject duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(TEST_USER)
        .expect(409);
    });

    it('should grant data consent', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ voiceRecording: true, dataProcessing: true })
        .expect(200)
        .then((r) => expect(r.body.consentGranted).toBe(true));
    });
  });

  describe('2. Placement Test', () => {
    it('should generate placement test questions', async () => {
      const res = await request(app.getHttpServer())
        .get('/learning/placement/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(15);
      expect(res.body.length).toBeLessThanOrEqual(25);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('type');
      expect(res.body[0]).toHaveProperty('options');
      expect(res.body[0]).toHaveProperty('correctIndex');
    });

    it('should evaluate placement test and return CEFR level', async () => {
      const questionsRes = await request(app.getHttpServer())
        .get('/learning/placement/generate')
        .set('Authorization', `Bearer ${accessToken}`);

      const answers = questionsRes.body.map((q: any) => ({
        questionId: q.id,
        selectedIndex: q.correctIndex,
      }));

      const res = await request(app.getHttpServer())
        .post('/learning/placement/evaluate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers })
        .expect(201);

      expect(res.body).toHaveProperty('cefrLevel');
      expect(['A1', 'A2', 'B1']).toContain(res.body.cefrLevel);
      expect(res.body.score).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('weakAreas');
      expect(res.body).toHaveProperty('strongAreas');
      expect(res.body).toHaveProperty('grammarScore');
      expect(res.body).toHaveProperty('vocabularyScore');
      expect(res.body).toHaveProperty('readingScore');
    });
  });

  describe('3. Roadmap', () => {
    it('should create a learning roadmap', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMonths: 6, currentCefr: 'A1', targetCefr: 'B1' })
        .expect(201);

      expect(res.body.milestones).toBeDefined();
      expect(res.body.milestones.length).toBeGreaterThanOrEqual(3);
      expect(res.body.currentCefr).toBe('A1');
      expect(res.body.targetCefr).toBe('B1');
    });

    it('should return active roadmap', async () => {
      await request(app.getHttpServer())
        .get('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((r) => {
          expect(r.body.milestones).toBeDefined();
          expect(r.body.currentCefr).toBeDefined();
        });
    });

    it('should return today plan', async () => {
      await request(app.getHttpServer())
        .get('/v1/roadmaps/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((r) => {
          expect(r.body.roadmap).toBeDefined();
        });
    });
  });

  describe('4. First Lesson', () => {
    let lessonId: string;

    it('should generate a daily lesson', async () => {
      const res = await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('content');
      expect(res.body.content).toHaveProperty('exercises');
      expect(res.body.content.exercises.length).toBeGreaterThanOrEqual(4);
      expect(res.body.content.exercises.length).toBeLessThanOrEqual(8);

      lessonId = res.body.id;
    });

    it('should check individual exercise answers', async () => {
      const lessonRes = await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`);

      const exercises = lessonRes.body.content.exercises;
      const firstListening = exercises.find((e: any) => e.type === 'listening');
      if (!firstListening) return;

      const res = await request(app.getHttpServer())
        .post(`/learning/lesson/${lessonRes.body.id}/check`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ exerciseId: firstListening.id, userAnswer: firstListening.correctIndex.toString() })
        .expect(201);

      expect(res.body).toHaveProperty('correct');
      expect(res.body).toHaveProperty('correctAnswer');
    });

    it('should submit batch answers and complete lesson', async () => {
      const lessonRes = await request(app.getHttpServer())
        .post('/learning/lesson/generate')
        .set('Authorization', `Bearer ${accessToken}`);

      const exercises = lessonRes.body.content.exercises;
      const answers = exercises
        .filter((e: any) => e.type === 'listening' || e.type === 'grammar' || e.type === 'vocabulary')
        .map((e: any) => ({
          exerciseId: e.id,
          userAnswer: e.correctIndex?.toString() || 'answer',
        }));

      const res = await request(app.getHttpServer())
        .post(`/learning/lesson/${lessonRes.body.id}/submit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers })
        .expect(201);

      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('totalScore');
      expect(res.body).toHaveProperty('totalCorrect');
    });
  });

  describe('5. Conversation with AI Tutor', () => {
    let socket: any;
    let sessionId: string;

    it('should connect to conversation WebSocket', (done) => {
      socket = SocketIOClient(
        `http://localhost:${(app.getHttpServer() as any)?.address?.()?.port || 3000}`,
        {
          path: '/conversation',
          auth: { token: accessToken },
          transports: ['websocket'],
          forceNew: true,
          timeout: 5000,
        },
      );

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        done();
      });

      socket.on('error', (err: any) => {
        done(err);
      });
    }, 10000);

    it('should start a conversation', (done) => {
      socket.emit('conversation:start', {
        scenario: 'ordering-food',
        level: 1,
      });

      socket.on('conversation:started', (data: any) => {
        expect(data.sessionId).toBeDefined();
        expect(data.scenario).toBe('ordering-food');
        expect(data.firstPrompt).toBeDefined();
        sessionId = data.sessionId;
        done();
      });

      socket.on('error', (err: any) => done(err));
    }, 10000);

    it('should send message and receive AI reply', (done) => {
      socket.emit('conversation:message', {
        sessionId,
        messageId: `msg-${Date.now()}`,
        text: 'Hello, I would like to order a burger please.',
      });

      socket.on('conversation:reply', (data: any) => {
        expect(data.response).toBeDefined();
        expect(data.messageId).toBeDefined();
        done();
      });

      socket.on('error', (err: any) => done(err));
    }, 15000);

    it('should handle message-id replay deduplication', (done) => {
      const msgId = `msg-dup-${Date.now()}`;

      socket.emit('conversation:message', {
        sessionId,
        messageId: msgId,
        text: 'What drinks do you have?',
      });

      setTimeout(() => {
        socket.emit('conversation:message', {
          sessionId,
          messageId: msgId,
          text: 'What drinks do you have?',
        });
      }, 200);

      let replyCount = 0;
      const timeout = setTimeout(() => {
        expect(replyCount).toBe(1);
        done();
      }, 3000);

      socket.on('conversation:reply', () => {
        replyCount++;
        if (replyCount > 1) {
          clearTimeout(timeout);
          done(new Error('Duplicate message was processed twice'));
        }
      });

      socket.on('error', () => {});
    }, 10000);

    it('should end conversation and receive summary', (done) => {
      socket.emit('conversation:end', { sessionId });

      socket.on('conversation:ended', (data: any) => {
        expect(data.sessionId).toBe(sessionId);
        expect(data.turnCount).toBeGreaterThanOrEqual(0);
        expect(data.summary).toBeDefined();
        socket.disconnect();
        done();
      });

      socket.on('error', (err: any) => done(err));
    }, 10000);

    afterAll(() => {
      if (socket?.connected) socket.disconnect();
    });
  });

  describe('6. Pronunciation Feedback', () => {
    it('should return pronunciation score for spoken text', async () => {
      const res = await request(app.getHttpServer())
        .post('/speech/pronunciation')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          referenceText: 'The cat sat on the mat',
          audioBuffer: Buffer.from('mock-audio-data').toString('base64'),
        })
        .expect(201);

      expect(res.body).toHaveProperty('overallScore');
      expect(res.body).toHaveProperty('fluencyScore');
      expect(res.body).toHaveProperty('accuracyScore');
      expect(res.body).toHaveProperty('wordScores');
      expect(res.body).toHaveProperty('feedback');
      expect(typeof res.body.overallScore).toBe('number');
      expect(res.body.overallScore).toBeGreaterThanOrEqual(0);
      expect(res.body.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return TTS audio for text', async () => {
      const res = await request(app.getHttpServer())
        .post('/speech/synthesize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ text: 'Hello, welcome to your English lesson.' })
        .expect(201);

      expect(res.body).toHaveProperty('audio');
      expect(res.body).toHaveProperty('format', 'wav');
      expect(res.body.audio.length).toBeGreaterThan(100);
    });
  });

  describe('7. Vocabulary Review', () => {
    it('should return due vocabulary reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/vocabulary/review')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should process vocabulary review with SM-5', async () => {
      const res = await request(app.getHttpServer())
        .post('/vocabulary/review')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ word: 'hello', quality: 4 })
        .expect(201);

      expect(res.body).toHaveProperty('score');
      expect(res.body).toHaveProperty('interval');
      expect(res.body).toHaveProperty('repetitions');
      expect(res.body).toHaveProperty('ease_factor');
      expect(res.body).toHaveProperty('next_review');
    });

    it('should return vocabulary stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/vocabulary/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('mastered');
      expect(res.body).toHaveProperty('learning');
      expect(res.body).toHaveProperty('dueToday');
      expect(res.body).toHaveProperty('retentionRate');
    });
  });

  describe('8. Progress Dashboard', () => {
    it('should return full user progress', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('currentLevel');
      expect(res.body).toHaveProperty('totalLessons');
      expect(res.body).toHaveProperty('averageScore');
      expect(res.body).toHaveProperty('streak');
      expect(res.body).toHaveProperty('vocabularyLearned');
      expect(res.body).toHaveProperty('cefrProgress');
      expect(res.body.cefrProgress).toHaveProperty('current');
      expect(res.body.cefrProgress).toHaveProperty('progress');
      expect(res.body).toHaveProperty('recentActivity');
    });

    it('should return streak data', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress/streak')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('streak');
      expect(typeof res.body.streak).toBe('number');
    });

    it('should return daily activity summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress/daily')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('lessonsCompleted');
      expect(res.body).toHaveProperty('averageScore');
      expect(res.body).toHaveProperty('streak');
    });
  });
});
