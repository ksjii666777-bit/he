import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('should return 404 on unknown route', () => {
      return request(app.getHttpServer())
        .get('/unknown')
        .expect(404);
    });
  });

  describe('Auth', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPass123',
      name: 'Test User',
      age: 25,
      countryCode: 'US',
      nativeLanguage: 'en',
      learningGoal: 'general',
      dailyStudyMin: 15,
    };

    it('POST /v1/auth/register — should register a new user', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201)
        .then((res) => {
          expect(res.body.user).toBeDefined();
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('POST /v1/auth/register — should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /v1/auth/login — should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('POST /v1/auth/login — should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword' })
        .expect(401);
    });

    it('POST /v1/auth/login — should reject unknown email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'unknown@test.com', password: 'TestPass123' })
        .expect(401);
    });

    it('POST /v1/auth/refresh — should issue new tokens', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('POST /v1/auth/refresh — should reject invalid token', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('GET /v1/users/me — should require auth', () => {
      return request(app.getHttpServer())
        .get('/v1/users/me')
        .expect(401);
    });

    it('GET /v1/users/me — should return profile with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      return request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.profile).toBeDefined();
          expect(res.body.profile.name).toBe(testUser.name);
        });
    });

    it('POST /v1/auth/logout — should invalidate session', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(204);
    });
  });

  describe('Consent', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'TestPass123' });
      accessToken = res.body.accessToken;
    });

    it('POST /v1/auth/consent — should grant consent', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ voiceRecording: true, dataProcessing: true })
        .expect(200)
        .then((res) => {
          expect(res.body.consentGranted).toBe(true);
        });
    });
  });

  describe('Roadmaps', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'TestPass123' });
      accessToken = res.body.accessToken;
    });

    it('POST /v1/roadmaps — should create roadmap', () => {
      return request(app.getHttpServer())
        .post('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMonths: 6, currentCefr: 'A1', targetCefr: 'B1' })
        .expect(201)
        .then((res) => {
          expect(res.body.milestones).toBeDefined();
          expect(res.body.milestones.length).toBe(6);
          expect(res.body.currentCefr).toBe('A1');
          expect(res.body.targetCefr).toBe('B1');
        });
    });

    it('GET /v1/roadmaps — should return active roadmap', () => {
      return request(app.getHttpServer())
        .get('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.milestones).toBeDefined();
        });
    });

    it('GET /v1/roadmaps/today — should return today plan', () => {
      return request(app.getHttpServer())
        .get('/v1/roadmaps/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.roadmap).toBeDefined();
        });
    });

    it('POST /v1/roadmaps — should reject duplicate roadmap', () => {
      return request(app.getHttpServer())
        .post('/v1/roadmaps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMonths: 3, currentCefr: 'A2', targetCefr: 'B1' })
        .expect(400);
    });
  });
});
