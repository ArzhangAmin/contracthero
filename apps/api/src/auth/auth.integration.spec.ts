import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Prisma, User } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaService } from '../database/prisma.service';
import { AuthModule } from './auth.module';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth.constants';

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

const getSetCookieArray = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header;
  }
  if (typeof header === 'string') {
    return [header];
  }
  return [];
};

const findCookie = (res: request.Response, name: string): string => {
  const cookies = getSetCookieArray(res);
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`cookie ${name} not set`);
  }
  return cookie.split(';')[0];
};

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
              JWT_ACCESS_EXPIRES_IN: '15m',
              JWT_REFRESH_EXPIRES_IN: '7d',
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

  it('registers a new user and sets HTTP-only access + refresh cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'jane@example.com',
      name: 'Jane',
      locale: Locale.DE,
    });
    const cookies = getSetCookieArray(res);
    expect(cookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))).toBe(true);
    expect(cookies.every((c) => /HttpOnly/i.test(c))).toBe(true);
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

  it('logs in successfully and returns the user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
    expect(findCookie(res, ACCESS_TOKEN_COOKIE)).toMatch(
      new RegExp(`^${ACCESS_TOKEN_COOKIE}=.+`),
    );
    expect(findCookie(res, REFRESH_TOKEN_COOKIE)).toMatch(
      new RegExp(`^${REFRESH_TOKEN_COOKIE}=.+`),
    );
  });

  it('rejects /auth/me without a cookie', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated via access cookie', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const accessCookie = findCookie(loginRes, ACCESS_TOKEN_COOKIE);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(credentials.email);
  });

  it('rejects /auth/me when a refresh token is presented as access', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const refreshCookie = findCookie(loginRes, REFRESH_TOKEN_COOKIE);
    // Rebrand the refresh cookie as access cookie
    const refreshValue = refreshCookie.split('=')[1];
    const fakeAccess = `${ACCESS_TOKEN_COOKIE}=${refreshValue}`;

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', fakeAccess);

    expect(meRes.status).toBe(401);
  });

  it('refreshes tokens using the refresh cookie', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const refreshCookie = findCookie(loginRes, REFRESH_TOKEN_COOKIE);

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.user.email).toBe(credentials.email);
    expect(findCookie(refreshRes, ACCESS_TOKEN_COOKIE)).toBeDefined();
    expect(findCookie(refreshRes, REFRESH_TOKEN_COOKIE)).toBeDefined();
  });

  it('rejects /auth/refresh without a refresh cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rejects /auth/refresh when an access token is supplied as refresh', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const accessCookie = findCookie(loginRes, ACCESS_TOKEN_COOKIE);
    const accessValue = accessCookie.split('=')[1];
    const fakeRefresh = `${REFRESH_TOKEN_COOKIE}=${accessValue}`;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', fakeRefresh);

    expect(res.status).toBe(401);
  });

  it('clears both cookies on logout', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout');
    expect(res.status).toBe(204);
    const cookies = getSetCookieArray(res);
    expect(cookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=;`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=;`))).toBe(true);
  });
});
