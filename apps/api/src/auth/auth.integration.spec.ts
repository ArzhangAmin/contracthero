import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Prisma, User } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaService } from '../database/prisma.service';
import { AuthModule } from './auth.module';

/**
 * In-memory Prisma double covering the calls used by the auth flow.
 * Avoids requiring a live database for integration tests.
 */
class InMemoryPrisma {
  private readonly usersById = new Map<string, User>();
  private readonly usersByEmail = new Map<string, User>();
  private idCounter = 0;

  user = {
    findUnique: async (args: {
      where: { id?: string; email?: string };
    }): Promise<User | null> => {
      if (args.where.id) {
        return this.usersById.get(args.where.id) ?? null;
      }
      if (args.where.email) {
        return this.usersByEmail.get(args.where.email) ?? null;
      }
      return null;
    },
    create: async (args: {
      data: {
        email: string;
        passwordHash: string;
        name: string;
        locale: Locale;
      };
    }): Promise<User> => {
      if (this.usersByEmail.has(args.data.email)) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`email`)',
          { code: 'P2002', clientVersion: 'test' },
        );
      }
      this.idCounter += 1;
      const user: User = {
        id: `user-${this.idCounter}`,
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        name: args.data.name,
        locale: args.data.locale,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.usersById.set(user.id, user);
      this.usersByEmail.set(user.email, user);
      return user;
    },
  };
}

describe('Auth (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret-at-least-32-chars-long-x',
              JWT_EXPIRES_IN: '1h',
              NODE_ENV: 'test',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(new InMemoryPrisma())
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
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

  const credentials = {
    email: 'jane@example.com',
    password: 'StrongPass123',
    name: 'Jane',
  };

  const extractAuthCookie = (res: request.Response): string => {
    const setCookieHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader as string]
        : [];
    const cookie = cookies.find((c) => c.startsWith('auth_token='));
    if (!cookie) {
      throw new Error('auth_token cookie not set');
    }
    return cookie.split(';')[0];
  };

  it('rejects registration with a weak password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...credentials, password: 'weakpass' });

    expect(res.status).toBe(400);
  });

  it('rejects registration with an invalid email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...credentials, email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('registers a new user and sets an HTTP-only cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        email: 'jane@example.com',
        name: 'Jane',
        locale: Locale.DE,
      },
    });
    const setCookieHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader as string]
        : [];
    expect(cookies.some((c) => /auth_token=.+/.test(c))).toBe(true);
    expect(cookies.some((c) => /HttpOnly/i.test(c))).toBe(true);
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials);

    expect(res.status).toBe(409);
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'WrongPass123' });

    expect(res.status).toBe(401);
  });

  it('rejects login for unknown user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: 'StrongPass123' });

    expect(res.status).toBe(401);
  });

  it('logs in successfully and returns a user payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
    expect(extractAuthCookie(res)).toMatch(/^auth_token=.+/);
  });

  it('rejects /auth/me without a cookie', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated via cookie', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const cookie = extractAuthCookie(loginRes);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(credentials.email);
  });

  it('returns the current user when authenticated via Bearer header', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const cookieValue = extractAuthCookie(loginRes).split('=')[1];

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${cookieValue}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(credentials.email);
  });

  it('clears the cookie on logout', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout');
    expect(res.status).toBe(204);
    const setCookieHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader as string]
        : [];
    expect(cookies.some((c) => /auth_token=;/.test(c))).toBe(true);
  });
});
