/**
 * Contracts controller integration tests.
 *
 * Boots a real Nest HTTP server (same pipes + cookie-parser as `main.ts`),
 * registers a user through `/auth/register` to obtain a real signed
 * access-token cookie, and exercises every CRUD endpoint end-to-end.
 *
 * Persistence is faked with `InMemoryContractsRepository` (a thin shim that
 * mimics the subset of PrismaClient the ContractsService actually uses).
 * This keeps the suite hermetic (no Postgres) while still exercising:
 *
 *   - JwtAuthGuard cookie extraction + 401 paths
 *   - ValidationPipe rejection of bad payloads
 *   - Ownership enforcement (user A cannot touch user B's contract)
 *   - Soft-delete semantics (deleted rows invisible to subsequent reads)
 *   - Pagination + filter + search filter combinations
 *
 * Every assertion maps to an acceptance criterion of issue #35.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Contract,
  ContractCategory,
  ContractStatus,
  Locale,
  Prisma,
  User,
} from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './../src/auth/constants/auth.constants';
import { PrismaService } from './../src/database/prisma.service';
import {
  CreateUserInput,
  UsersService,
} from './../src/users/users.service';

const TEST_JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';
const HTTP_CREATED = 201;
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const ID_RADIX = 36;

const PASSWORD = 'StrongPass123';
const USER_A = { email: 'alice@example.com', name: 'Alice' };
const USER_B = { email: 'bob@example.com', name: 'Bob' };

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

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
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
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

interface ContractWhere {
  id?: string;
  userId?: string;
  deletedAt?: Date | null;
  status?: ContractStatus;
  category?: ContractCategory;
  OR?: Array<{
    title?: { contains: string; mode: 'insensitive' };
    counterparty?: { contains: string; mode: 'insensitive' };
  }>;
}

/**
 * Minimal in-memory replacement for the slice of PrismaClient that
 * ContractsService touches. Only the operations the service actually calls
 * are implemented; anything else throws so a future refactor fails loudly
 * instead of silently returning `undefined`.
 */
class InMemoryPrisma {
  private rows: Contract[] = [];
  private counter = 0;

  reset(): void {
    this.rows = [];
    this.counter = 0;
  }

  // --- Lifecycle (no-op so DatabaseModule can init/destroy cleanly) ---
  onModuleInit = (): Promise<void> => Promise.resolve();
  onModuleDestroy = (): Promise<void> => Promise.resolve();

  // --- $transaction passthrough (ContractsService uses array form) ---
  $transaction = <T>(ops: Promise<T>[]): Promise<T[]> => Promise.all(ops);

  // --- Contract delegate ---
  contract = {
    create: (args: { data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> }): Promise<Contract> => {
      this.counter += 1;
      const id = `c-${this.counter.toString(ID_RADIX)}`;
      const now = new Date();
      const row: Contract = {
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        filePath: null,
        notes: null,
        noticePeriodDays: null,
        autoRenew: false,
        value: null,
        currency: null,
        status: ContractStatus.ACTIVE,
        ...args.data,
      } as Contract;
      this.rows.push(row);
      return Promise.resolve(row);
    },

    findFirst: (args: { where: ContractWhere }): Promise<Contract | null> => {
      const match = this.rows.find((r) => this.matches(r, args.where));
      return Promise.resolve(match ?? null);
    },

    findMany: (args: {
      where: ContractWhere;
      skip?: number;
      take?: number;
    }): Promise<Contract[]> => {
      const filtered = this.rows.filter((r) => this.matches(r, args.where));
      // Mirror the service's `orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }]`.
      filtered.sort((a, b) => {
        const byEnd = a.endDate.getTime() - b.endDate.getTime();
        if (byEnd !== 0) return byEnd;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      const skip = args.skip ?? 0;
      const take = args.take ?? filtered.length;
      return Promise.resolve(filtered.slice(skip, skip + take));
    },

    count: (args: { where: ContractWhere }): Promise<number> => {
      return Promise.resolve(
        this.rows.filter((r) => this.matches(r, args.where)).length,
      );
    },

    update: (args: { where: { id: string }; data: Partial<Contract> }): Promise<Contract> => {
      const idx = this.rows.findIndex((r) => r.id === args.where.id);
      if (idx === -1) {
        throw new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        });
      }
      const next: Contract = {
        ...this.rows[idx],
        ...args.data,
        updatedAt: new Date(),
      } as Contract;
      this.rows[idx] = next;
      return Promise.resolve(next);
    },

    updateMany: (args: {
      where: ContractWhere;
      data: Partial<Contract>;
    }): Promise<{ count: number }> => {
      let count = 0;
      this.rows = this.rows.map((r) => {
        if (this.matches(r, args.where)) {
          count += 1;
          return { ...r, ...args.data, updatedAt: new Date() } as Contract;
        }
        return r;
      });
      return Promise.resolve({ count });
    },
  };

  private matches(row: Contract, where: ContractWhere): boolean {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.userId !== undefined && row.userId !== where.userId) return false;
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (where.deletedAt instanceof Date && row.deletedAt === null) return false;
    if (where.status !== undefined && row.status !== where.status) return false;
    if (where.category !== undefined && row.category !== where.category) {
      return false;
    }
    if (where.OR !== undefined) {
      const anyMatch = where.OR.some((cond) => {
        if (cond.title) {
          return row.title
            .toLowerCase()
            .includes(cond.title.contains.toLowerCase());
        }
        if (cond.counterparty) {
          return row.counterparty
            .toLowerCase()
            .includes(cond.counterparty.contains.toLowerCase());
        }
        return false;
      });
      if (!anyMatch) return false;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extractRawCookie = (
  cookies: string[] | undefined,
  name: string,
): string | undefined => {
  const header = (cookies ?? []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0] : undefined;
};

interface Session {
  accessCookie: string;
  refreshCookie: string;
  userId: string;
}

const registerUser = async (
  httpServer: App,
  email: string,
  name: string,
): Promise<Session> => {
  const res = await request(httpServer)
    .post('/auth/register')
    .send({ email, password: PASSWORD, name })
    .expect(HTTP_CREATED);
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  const accessCookie = extractRawCookie(cookies, ACCESS_TOKEN_COOKIE);
  const refreshCookie = extractRawCookie(cookies, REFRESH_TOKEN_COOKIE);
  if (!accessCookie || !refreshCookie) {
    throw new Error('Registration did not set both auth cookies');
  }
  const userId = res.body.user.id as string;
  return { accessCookie, refreshCookie, userId };
};

const validContractPayload = (): Record<string, unknown> => ({
  title: 'Apartment Lease',
  category: ContractCategory.RENT,
  counterparty: 'Vonovia SE',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2026-01-01T00:00:00.000Z',
  noticePeriodDays: 90,
  autoRenew: false,
  value: 1250.5,
  currency: 'EUR',
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ContractsController (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let users: InMemoryUsersService;
  let prisma: InMemoryPrisma;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.NODE_ENV = 'test';

    users = new InMemoryUsersService();
    prisma = new InMemoryPrisma();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersService)
      .useValue(users)
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
    prisma.reset();
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  describe('auth', () => {
    it.each([
      ['POST', '/contracts'],
      ['GET', '/contracts'],
      ['GET', '/contracts/some-id'],
      ['PATCH', '/contracts/some-id'],
      ['DELETE', '/contracts/some-id'],
    ])('%s %s returns 401 without an access cookie', async (method, path) => {
      const verb = method.toLowerCase() as
        | 'post'
        | 'get'
        | 'patch'
        | 'delete';
      const response = await request(httpServer)[verb](path).send({});
      expect(response.status).toBe(HTTP_UNAUTHORIZED);
    });
  });

  // -------------------------------------------------------------------------
  // POST /contracts
  // -------------------------------------------------------------------------

  describe('POST /contracts', () => {
    it('creates a contract for the current user and returns it serialized', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload());

      expect(response.status).toBe(HTTP_CREATED);
      expect(response.body).toMatchObject({
        userId: session.userId,
        title: 'Apartment Lease',
        category: ContractCategory.RENT,
        counterparty: 'Vonovia SE',
        status: ContractStatus.ACTIVE,
        currency: 'EUR',
        value: '1250.5',
      });
      expect(response.body.id).toEqual(expect.any(String));
      // The deletedAt field is internal; the response DTO must hide it.
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('rejects a payload where endDate <= startDate with 400', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({
          ...validContractPayload(),
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2025-01-01T00:00:00.000Z',
        });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
    });

    it('rejects an invalid currency code with 400', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), currency: 'EURO' });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
    });

    it('rejects unknown fields (whitelist + forbidNonWhitelisted)', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), isAdmin: true });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
    });

    it('normalizes lowercase currency input to uppercase', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), currency: 'usd' });

      expect(response.status).toBe(HTTP_CREATED);
      expect(response.body.currency).toBe('USD');
    });
  });

  // -------------------------------------------------------------------------
  // GET /contracts (list)
  // -------------------------------------------------------------------------

  describe('GET /contracts', () => {
    it('returns only the calling user’s contracts (no cross-tenant leakage)', async () => {
      const alice = await registerUser(httpServer, USER_A.email, USER_A.name);
      const bob = await registerUser(httpServer, USER_B.email, USER_B.name);

      await request(httpServer)
        .post('/contracts')
        .set('Cookie', alice.accessCookie)
        .send({ ...validContractPayload(), title: 'Alice contract' })
        .expect(HTTP_CREATED);

      await request(httpServer)
        .post('/contracts')
        .set('Cookie', bob.accessCookie)
        .send({ ...validContractPayload(), title: 'Bob contract' })
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .get('/contracts')
        .set('Cookie', alice.accessCookie)
        .expect(HTTP_OK);

      expect(response.body.total).toBe(1);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].title).toBe('Alice contract');
    });

    it('paginates with page + pageSize and computes totalPages correctly', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      // Create 3 contracts with distinct end dates so ordering is stable.
      for (let i = 0; i < 3; i += 1) {
        await request(httpServer)
          .post('/contracts')
          .set('Cookie', session.accessCookie)
          .send({
            ...validContractPayload(),
            title: `Contract ${i}`,
            endDate: new Date(2026, i, 1).toISOString(),
          })
          .expect(HTTP_CREATED);
      }

      const page1 = await request(httpServer)
        .get('/contracts?page=1&pageSize=2')
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.total).toBe(3);
      expect(page1.body.totalPages).toBe(2);

      const page2 = await request(httpServer)
        .get('/contracts?page=2&pageSize=2')
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);
      expect(page2.body.items).toHaveLength(1);
    });

    it('filters by status and category', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), category: ContractCategory.RENT })
        .expect(HTTP_CREATED);

      const insuranceRes = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({
          ...validContractPayload(),
          title: 'Health insurance',
          category: ContractCategory.INSURANCE,
        })
        .expect(HTTP_CREATED);

      // Move the insurance row to EXPIRED via PATCH so we can filter by it.
      await request(httpServer)
        .patch(`/contracts/${insuranceRes.body.id}`)
        .set('Cookie', session.accessCookie)
        .send({ status: ContractStatus.EXPIRED })
        .expect(HTTP_OK);

      const byStatus = await request(httpServer)
        .get(`/contracts?status=${ContractStatus.EXPIRED}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);
      expect(byStatus.body.total).toBe(1);
      expect(byStatus.body.items[0].status).toBe(ContractStatus.EXPIRED);

      const byCategory = await request(httpServer)
        .get(`/contracts?category=${ContractCategory.RENT}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);
      expect(byCategory.body.total).toBe(1);
      expect(byCategory.body.items[0].category).toBe(ContractCategory.RENT);
    });

    it('search matches title or counterparty case-insensitively', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), counterparty: 'Allianz' })
        .expect(HTTP_CREATED);
      await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send({ ...validContractPayload(), counterparty: 'Vodafone' })
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .get('/contracts?search=alli')
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].counterparty).toBe('Allianz');
    });

    it('rejects pageSize over the cap with 400', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .get('/contracts?pageSize=10000')
        .set('Cookie', session.accessCookie);

      expect(response.status).toBe(HTTP_BAD_REQUEST);
    });
  });

  // -------------------------------------------------------------------------
  // GET /contracts/:id
  // -------------------------------------------------------------------------

  describe('GET /contracts/:id', () => {
    it('returns the contract when the caller owns it', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .get(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);

      expect(response.body.id).toBe(created.body.id);
    });

    it('returns 404 (not 403) when another user owns the contract', async () => {
      const alice = await registerUser(httpServer, USER_A.email, USER_A.name);
      const bob = await registerUser(httpServer, USER_B.email, USER_B.name);

      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', alice.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .get(`/contracts/${created.body.id}`)
        .set('Cookie', bob.accessCookie);

      expect(response.status).toBe(HTTP_NOT_FOUND);
    });

    it('returns 404 for a non-existent id', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);

      const response = await request(httpServer)
        .get('/contracts/does-not-exist')
        .set('Cookie', session.accessCookie);

      expect(response.status).toBe(HTTP_NOT_FOUND);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /contracts/:id
  // -------------------------------------------------------------------------

  describe('PATCH /contracts/:id', () => {
    it('updates only supplied fields', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .patch(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .send({ title: 'Renamed', autoRenew: true })
        .expect(HTTP_OK);

      expect(response.body.title).toBe('Renamed');
      expect(response.body.autoRenew).toBe(true);
      // Unspecified fields are preserved.
      expect(response.body.counterparty).toBe('Vonovia SE');
    });

    it('rejects a partial update that would make endDate <= startDate (cross-field)', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .patch(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .send({ startDate: '2027-01-01T00:00:00.000Z' });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
    });

    it('returns 404 when another user attempts to update', async () => {
      const alice = await registerUser(httpServer, USER_A.email, USER_A.name);
      const bob = await registerUser(httpServer, USER_B.email, USER_B.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', alice.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      const response = await request(httpServer)
        .patch(`/contracts/${created.body.id}`)
        .set('Cookie', bob.accessCookie)
        .send({ title: 'Hijacked' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /contracts/:id (soft delete)
  // -------------------------------------------------------------------------

  describe('DELETE /contracts/:id', () => {
    it('soft-deletes and subsequent reads return 404 / exclude from list', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      await request(httpServer)
        .delete(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_NO_CONTENT);

      // GET by id -> 404
      await request(httpServer)
        .get(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_NOT_FOUND);

      // LIST -> empty
      const listRes = await request(httpServer)
        .get('/contracts')
        .set('Cookie', session.accessCookie)
        .expect(HTTP_OK);
      expect(listRes.body.total).toBe(0);
      expect(listRes.body.items).toEqual([]);
    });

    it('a second DELETE on the same row returns 404 (no silent re-delete)', async () => {
      const session = await registerUser(httpServer, USER_A.email, USER_A.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', session.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      await request(httpServer)
        .delete(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_NO_CONTENT);

      await request(httpServer)
        .delete(`/contracts/${created.body.id}`)
        .set('Cookie', session.accessCookie)
        .expect(HTTP_NOT_FOUND);
    });

    it('returns 404 when another user attempts to delete', async () => {
      const alice = await registerUser(httpServer, USER_A.email, USER_A.name);
      const bob = await registerUser(httpServer, USER_B.email, USER_B.name);
      const created = await request(httpServer)
        .post('/contracts')
        .set('Cookie', alice.accessCookie)
        .send(validContractPayload())
        .expect(HTTP_CREATED);

      await request(httpServer)
        .delete(`/contracts/${created.body.id}`)
        .set('Cookie', bob.accessCookie)
        .expect(HTTP_NOT_FOUND);

      // Alice can still see her contract — Bob's DELETE was a no-op.
      await request(httpServer)
        .get(`/contracts/${created.body.id}`)
        .set('Cookie', alice.accessCookie)
        .expect(HTTP_OK);
    });
  });
});
