/**
 * Auth controller integration tests.
 *
 * Bootstraps a real Nest HTTP server with the same middleware/pipes wired in
 * `main.ts` (cookie-parser, global ValidationPipe). The persistence layer is
 * stubbed with an in-memory `UsersService` so the suite can exercise the
 * full HTTP -> Controller -> Service -> JWT -> Cookie flow without requiring
 * a live Postgres instance.
 *
 * Every assertion below maps to an acceptance criterion of the
 * [contracthero] Sub-task 4 ticket: register, login, logout, refresh, me.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Prisma, User } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  ACCESS_TOKEN_COOKIE,
  FIFTEEN_MINUTES_MS,
  REFRESH_TOKEN_COOKIE,
  SEVEN_DAYS_MS,
} from './../src/auth/constants/auth.constants';
import { PrismaService } from './../src/database/prisma.service';
import {
  CreateUserInput,
  UsersService,
} from './../src/users/users.service';

const TEST_JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NO_CONTENT = 204;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_CONFLICT = 409;
const ID_RADIX = 36;

const VALID_PASSWORD = 'StrongPass123';
const VALID_EMAIL = 'jane@example.com';
const VALID_NAME = 'Jane Doe';

/**
 * Minimal in-memory replacement for UsersService. Reproduces the unique-email
 * constraint so AuthService's P2002 -> ConflictException mapping is covered.
 */
class InMemoryUsersService {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, User>();
  private counter = 0;

  reset(): void {
    this.byId.clear();
    this.byEmail.clear();
    this.counter = 0;
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.byEmail.get(email.toLowerCase()) ?? null);
  }

  create(input: CreateUserInput): Promise<User> {
    const normalizedEmail = input.email.toLowerCase();
    if (this.byEmail.has(normalizedEmail)) {
      // Mimic the structured error that PrismaClient throws on unique
      // constraint violation so AuthService's catch branch is exercised.
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          code: PRISMA_UNIQUE_CONSTRAINT_CODE,
          clientVersion: 'test',
          meta: { target: ['email'] },
        },
      );
    }
    this.counter += 1;
    const id = `user-${this.counter.toString(ID_RADIX)}`;
    const now = new Date();
    const user: User = {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      name: input.name,
      locale: input.locale ?? Locale.DE,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(id, user);
    this.byEmail.set(normalizedEmail, user);
    return Promise.resolve(user);
  }
}

/**
 * No-op Prisma stub so `onModuleInit`/`onModuleDestroy` don't try to connect.
 */
const buildPrismaStub = (): Partial<PrismaService> => ({
  onModuleInit: () => Promise.resolve(),
  onModuleDestroy: () => Promise.resolve(),
});

interface ParsedCookie {
  value: string;
  attributes: Record<string, string | true>;
}

const parseSetCookie = (header: string): ParsedCookie => {
  const [pair, ...rawAttrs] = header.split(';').map((part) => part.trim());
  const eqIdx = pair.indexOf('=');
  const value = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
  const attributes: Record<string, string | true> = {};
  for (const attr of rawAttrs) {
    const idx = attr.indexOf('=');
    if (idx === -1) {
      attributes[attr.toLowerCase()] = true;
    } else {
      attributes[attr.slice(0, idx).toLowerCase()] = attr.slice(idx + 1);
    }
  }
  return { value, attributes };
};

const findCookie = (
  cookies: string[] | undefined,
  name: string,
): ParsedCookie | undefined => {
  const header = (cookies ?? []).find((c) => c.startsWith(`${name}=`));
  return header ? parseSetCookie(header) : undefined;
};

const extractRawCookie = (
  cookies: string[] | undefined,
  name: string,
): string | undefined => {
  const header = (cookies ?? []).find((c) => c.startsWith(`${name}=`));
  if (!header) return undefined;
  return header.split(';')[0];
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let users: InMemoryUsersService;
  let httpServer: App;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.NODE_ENV = 'test';

    users = new InMemoryUsersService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersService)
      .useValue(users)
      .overrideProvider(PrismaService)
      .useValue(buildPrismaStub())
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    users.reset();
  });

  describe('POST /auth/register', () => {
    it('creates the user, returns the public profile, and sets both auth cookies', async () => {
      const response = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
      });

      expect(response.status).toBe(HTTP_STATUS_CREATED);
      expect(response.body).toMatchObject({
        user: {
          email: VALID_EMAIL,
          name: VALID_NAME,
          locale: Locale.DE,
        },
      });
      expect(response.body.user.id).toEqual(expect.any(String));
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const setCookies = response.headers['set-cookie'] as
        | string[]
        | undefined;
      const access = findCookie(setCookies, ACCESS_TOKEN_COOKIE);
      const refresh = findCookie(setCookies, REFRESH_TOKEN_COOKIE);

      expect(access).toBeDefined();
      expect(refresh).toBeDefined();
      expect(access?.attributes.httponly).toBe(true);
      expect(refresh?.attributes.httponly).toBe(true);
      expect(String(access?.attributes.samesite).toLowerCase()).toBe('lax');
      expect(String(refresh?.attributes.samesite).toLowerCase()).toBe('lax');
      expect(access?.attributes.path).toBe('/');
      expect(refresh?.attributes.path).toBe('/');
      // maxAge is emitted by Express as `Max-Age=<seconds>`.
      expect(Number(access?.attributes['max-age'])).toBe(
        FIFTEEN_MINUTES_MS / 1000,
      );
      expect(Number(refresh?.attributes['max-age'])).toBe(SEVEN_DAYS_MS / 1000);
    });

    it('rejects a duplicate email with 409 Conflict', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD, name: VALID_NAME })
        .expect(HTTP_STATUS_CREATED);

      const dup = await request(httpServer)
        .post('/auth/register')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD, name: VALID_NAME });

      expect(dup.status).toBe(HTTP_STATUS_CONFLICT);
    });

    it('rejects a weak password via DTO validation (400)', async () => {
      const response = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: 'weak',
        name: VALID_NAME,
      });

      expect(response.status).toBe(HTTP_STATUS_BAD_REQUEST);
      const setCookies = response.headers['set-cookie'] as string[] | undefined;
      expect(findCookie(setCookies, ACCESS_TOKEN_COOKIE)).toBeUndefined();
    });

    it('rejects unknown fields (whitelist + forbidNonWhitelisted)', async () => {
      const response = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
        role: 'admin',
      });

      expect(response.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD, name: VALID_NAME })
        .expect(HTTP_STATUS_CREATED);
    });

    it('returns 200 with the user and sets both auth cookies', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

      expect(response.status).toBe(HTTP_STATUS_OK);
      expect(response.body.user.email).toBe(VALID_EMAIL);

      const setCookies = response.headers['set-cookie'] as string[] | undefined;
      expect(findCookie(setCookies, ACCESS_TOKEN_COOKIE)).toBeDefined();
      expect(findCookie(setCookies, REFRESH_TOKEN_COOKIE)).toBeDefined();
    });

    it('rejects a wrong password with 401 and emits no cookies', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: VALID_EMAIL, password: 'WrongPass123' });

      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
      const setCookies = response.headers['set-cookie'] as string[] | undefined;
      expect(findCookie(setCookies, ACCESS_TOKEN_COOKIE)).toBeUndefined();
      expect(findCookie(setCookies, REFRESH_TOKEN_COOKIE)).toBeUndefined();
    });

    it('rejects an unknown email with 401', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: VALID_PASSWORD });

      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a fresh token pair when called with a valid refresh cookie', async () => {
      const register = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
      });
      const setCookies = register.headers['set-cookie'] as string[] | undefined;
      const refreshCookie = extractRawCookie(setCookies, REFRESH_TOKEN_COOKIE);
      expect(refreshCookie).toBeDefined();

      const response = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie as string);

      expect(response.status).toBe(HTTP_STATUS_OK);
      expect(response.body.user.email).toBe(VALID_EMAIL);

      const newCookies = response.headers['set-cookie'] as string[] | undefined;
      expect(findCookie(newCookies, ACCESS_TOKEN_COOKIE)).toBeDefined();
      expect(findCookie(newCookies, REFRESH_TOKEN_COOKIE)).toBeDefined();
    });

    it('returns 401 when no refresh cookie is present', async () => {
      const response = await request(httpServer).post('/auth/refresh');
      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('returns 401 when the refresh cookie is malformed', async () => {
      const response = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=not-a-real-jwt`);

      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('returns 401 when an access token is sent in place of the refresh token', async () => {
      const register = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
      });
      const setCookies = register.headers['set-cookie'] as string[] | undefined;
      const access = extractRawCookie(setCookies, ACCESS_TOKEN_COOKIE);
      const accessValue = access?.split('=')[1];

      const response = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${accessValue}`);

      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and clears both auth cookies', async () => {
      const response = await request(httpServer).post('/auth/logout');

      expect(response.status).toBe(HTTP_STATUS_NO_CONTENT);

      const setCookies = response.headers['set-cookie'] as string[] | undefined;
      const access = findCookie(setCookies, ACCESS_TOKEN_COOKIE);
      const refresh = findCookie(setCookies, REFRESH_TOKEN_COOKIE);

      expect(access).toBeDefined();
      expect(refresh).toBeDefined();
      // Express clears a cookie by setting its value empty + Expires in the past.
      expect(access?.value).toBe('');
      expect(refresh?.value).toBe('');
      expect(access?.attributes.httponly).toBe(true);
      expect(refresh?.attributes.httponly).toBe(true);
      expect(access?.attributes.path).toBe('/');
      expect(refresh?.attributes.path).toBe('/');
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without an access cookie', async () => {
      const response = await request(httpServer).get('/auth/me');
      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('returns the current user when called with a valid access cookie', async () => {
      const register = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
      });
      const setCookies = register.headers['set-cookie'] as string[] | undefined;
      const accessCookie = extractRawCookie(setCookies, ACCESS_TOKEN_COOKIE);
      expect(accessCookie).toBeDefined();

      const response = await request(httpServer)
        .get('/auth/me')
        .set('Cookie', accessCookie as string);

      expect(response.status).toBe(HTTP_STATUS_OK);
      expect(response.body).toMatchObject({
        user: {
          email: VALID_EMAIL,
          name: VALID_NAME,
          locale: Locale.DE,
        },
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 when a refresh token is presented as the access cookie', async () => {
      const register = await request(httpServer).post('/auth/register').send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        name: VALID_NAME,
      });
      const setCookies = register.headers['set-cookie'] as string[] | undefined;
      const refresh = extractRawCookie(setCookies, REFRESH_TOKEN_COOKIE);
      const refreshValue = refresh?.split('=')[1];

      const response = await request(httpServer)
        .get('/auth/me')
        .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${refreshValue}`);

      expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });
  });
});
