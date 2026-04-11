import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1', () => {
    it('returns 200 with API info', () => {
      return request(app.getHttpServer())
        .get('/api/v1')
        .expect(200)
        .expect((res) => {
          // ResponseInterceptor wraps all responses: { status, data }
          expect(res.body.status).toBe('success');
          expect(res.body.data).toHaveProperty('name', 'LintWise API');
          expect(res.body.data).toHaveProperty('version');
        });
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for undefined routes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/does-not-exist')
        .expect(404);
    });
  });

  describe('Security headers', () => {
    it('includes X-Content-Type-Options header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('includes X-Frame-Options header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
