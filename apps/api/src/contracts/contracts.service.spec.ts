import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Contract,
  ContractCategory,
  ContractStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ContractsService } from './contracts.service';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from './constants/contracts.constants';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts.query.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const CONTRACT_ID = 'contract-1';

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: CONTRACT_ID,
  userId: USER_ID,
  title: 'Lease',
  category: ContractCategory.RENT,
  counterparty: 'Vonovia',
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2026-01-01T00:00:00Z'),
  noticePeriodDays: 90,
  autoRenew: false,
  value: new Prisma.Decimal('1250.50'),
  currency: 'EUR',
  status: ContractStatus.ACTIVE,
  notes: null,
  filePath: null,
  deletedAt: null,
  createdAt: new Date('2024-12-01T00:00:00Z'),
  updatedAt: new Date('2024-12-01T00:00:00Z'),
  ...overrides,
});

const buildCreateDto = (
  overrides: Partial<CreateContractDto> = {},
): CreateContractDto => ({
  title: 'Lease',
  category: ContractCategory.RENT,
  counterparty: 'Vonovia',
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2026-01-01T00:00:00Z'),
  noticePeriodDays: 90,
  autoRenew: false,
  value: 1250.5,
  currency: 'EUR',
  status: ContractStatus.ACTIVE,
  notes: undefined,
  ...overrides,
});

const buildListQuery = (
  overrides: Partial<ListContractsQueryDto> = {},
): ListContractsQueryDto => {
  const q = new ListContractsQueryDto();
  q.page = overrides.page ?? DEFAULT_PAGE;
  q.pageSize = overrides.pageSize ?? DEFAULT_PAGE_SIZE;
  q.status = overrides.status;
  q.category = overrides.category;
  q.search = overrides.search;
  return q;
};

interface PrismaMock {
  contract: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const buildPrismaMock = (): PrismaMock => {
  const mock: PrismaMock = {
    contract: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    // The service uses `$transaction([findMany, count])`. Resolve in declared order.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return mock;
};

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ContractsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('persists the row with the caller as owner and converts value to Decimal', async () => {
      const created = buildContract();
      prisma.contract.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, buildCreateDto());

      expect(prisma.contract.create).toHaveBeenCalledTimes(1);
      const callArg = prisma.contract.create.mock.calls[0][0] as {
        data: { userId: string; value: Prisma.Decimal | null };
      };
      expect(callArg.data.userId).toBe(USER_ID);
      expect(callArg.data.value).toBeInstanceOf(Prisma.Decimal);
      expect((callArg.data.value as Prisma.Decimal).toString()).toBe('1250.5');
      expect(result).toBe(created);
    });

    it('omits optional fields entirely when undefined (so Prisma applies schema defaults)', async () => {
      // Critical: passing `status: undefined` via spread would OVERRIDE
      // `@default(ACTIVE)`. Building data incrementally ensures defaults
      // declared in schema.prisma actually take effect.
      prisma.contract.create.mockResolvedValue(buildContract({ value: null }));

      await service.create(
        USER_ID,
        buildCreateDto({
          value: undefined,
          currency: undefined,
          status: undefined,
          autoRenew: undefined,
          noticePeriodDays: undefined,
          notes: undefined,
        }),
      );

      const callArg = prisma.contract.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      // Only the required + user-supplied fields are present.
      expect(callArg.data).not.toHaveProperty('value');
      expect(callArg.data).not.toHaveProperty('currency');
      expect(callArg.data).not.toHaveProperty('status');
      expect(callArg.data).not.toHaveProperty('autoRenew');
      expect(callArg.data).not.toHaveProperty('noticePeriodDays');
      expect(callArg.data).not.toHaveProperty('notes');
      // ...but required fields still flow through.
      expect(callArg.data.userId).toBe(USER_ID);
      expect(callArg.data.title).toBe('Lease');
    });
  });

  describe('findAllForUser', () => {
    it('scopes the query by userId and filters out soft-deleted rows', async () => {
      prisma.contract.findMany.mockResolvedValue([buildContract()]);
      prisma.contract.count.mockResolvedValue(1);

      await service.findAllForUser(USER_ID, buildListQuery());

      const where = (
        prisma.contract.findMany.mock.calls[0][0] as { where: { userId: string; deletedAt: null } }
      ).where;
      expect(where.userId).toBe(USER_ID);
      expect(where.deletedAt).toBeNull();
    });

    it('applies pagination via skip/take derived from page + pageSize', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      prisma.contract.count.mockResolvedValue(0);

      await service.findAllForUser(
        USER_ID,
        buildListQuery({ page: 3, pageSize: 10 }),
      );

      const args = prisma.contract.findMany.mock.calls[0][0] as {
        skip: number;
        take: number;
      };
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    it('applies status, category, and search filters when provided', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      prisma.contract.count.mockResolvedValue(0);

      await service.findAllForUser(
        USER_ID,
        buildListQuery({
          status: ContractStatus.EXPIRED,
          category: ContractCategory.INSURANCE,
          search: '  Allianz  ',
        }),
      );

      const where = (
        prisma.contract.findMany.mock.calls[0][0] as {
          where: {
            status: ContractStatus;
            category: ContractCategory;
            OR: Array<Record<string, unknown>>;
          };
        }
      ).where;
      expect(where.status).toBe(ContractStatus.EXPIRED);
      expect(where.category).toBe(ContractCategory.INSURANCE);
      expect(where.OR).toEqual([
        { title: { contains: 'Allianz', mode: 'insensitive' } },
        { counterparty: { contains: 'Allianz', mode: 'insensitive' } },
      ]);
    });

    it('ignores a search term that is empty or whitespace-only', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      prisma.contract.count.mockResolvedValue(0);

      await service.findAllForUser(USER_ID, buildListQuery({ search: '   ' }));

      const where = (
        prisma.contract.findMany.mock.calls[0][0] as {
          where: { OR?: unknown };
        }
      ).where;
      expect(where.OR).toBeUndefined();
    });
  });

  describe('findOneForUser', () => {
    it('returns the contract when the caller owns it', async () => {
      const row = buildContract();
      prisma.contract.findFirst.mockResolvedValue(row);

      const result = await service.findOneForUser(USER_ID, CONTRACT_ID);

      expect(prisma.contract.findFirst).toHaveBeenCalledWith({
        where: { id: CONTRACT_ID, userId: USER_ID, deletedAt: null },
      });
      expect(result).toBe(row);
    });

    it('throws NotFound when the row does not exist OR belongs to another user (no 403 leak)', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForUser(OTHER_USER_ID, CONTRACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats soft-deleted rows as not found', async () => {
      // findFirst returns null because the where clause includes `deletedAt: null`.
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForUser(USER_ID, CONTRACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates only supplied fields and preserves ownership scope', async () => {
      const existing = buildContract();
      prisma.contract.findFirst.mockResolvedValue(existing);
      prisma.contract.update.mockImplementation(
        (args: { data: Partial<Contract> }) =>
          Promise.resolve({ ...existing, ...args.data }),
      );

      const dto: UpdateContractDto = { title: 'New title', autoRenew: true };
      const result = await service.update(USER_ID, CONTRACT_ID, dto);

      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: CONTRACT_ID },
        data: { title: 'New title', autoRenew: true },
      });
      expect(result.title).toBe('New title');
      expect(result.autoRenew).toBe(true);
    });

    it('rejects a partial update that would leave endDate <= startDate', async () => {
      const existing = buildContract({
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2026-01-01T00:00:00Z'),
      });
      prisma.contract.findFirst.mockResolvedValue(existing);

      // Caller bumps startDate past the existing endDate — must fail.
      await expect(
        service.update(USER_ID, CONTRACT_ID, {
          startDate: new Date('2027-01-01T00:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.contract.update).not.toHaveBeenCalled();
    });

    it('rejects when endDate equals startDate (strictly-after semantics)', async () => {
      const existing = buildContract();
      prisma.contract.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(USER_ID, CONTRACT_ID, {
          endDate: existing.startDate,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the contract is missing or owned by someone else', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, CONTRACT_ID, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contract.update).not.toHaveBeenCalled();
    });

    it('converts an updated numeric `value` into a Prisma.Decimal', async () => {
      prisma.contract.findFirst.mockResolvedValue(buildContract());
      prisma.contract.update.mockResolvedValue(buildContract());

      await service.update(USER_ID, CONTRACT_ID, { value: 99.99 });

      const data = (
        prisma.contract.update.mock.calls[0][0] as { data: { value?: unknown } }
      ).data;
      expect(data.value).toBeInstanceOf(Prisma.Decimal);
      expect((data.value as Prisma.Decimal).toString()).toBe('99.99');
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt scoped by (id, userId, deletedAt: null) and returns void on success', async () => {
      prisma.contract.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.softDelete(USER_ID, CONTRACT_ID),
      ).resolves.toBeUndefined();

      const callArg = prisma.contract.updateMany.mock.calls[0][0] as {
        where: { id: string; userId: string; deletedAt: null };
        data: { deletedAt: Date };
      };
      expect(callArg.where).toEqual({
        id: CONTRACT_ID,
        userId: USER_ID,
        deletedAt: null,
      });
      expect(callArg.data.deletedAt).toBeInstanceOf(Date);
    });

    it('throws NotFound when the row is missing, already soft-deleted, or owned by another user', async () => {
      prisma.contract.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.softDelete(OTHER_USER_ID, CONTRACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.contract.updateMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.softDelete(USER_ID, CONTRACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('re-throws unexpected Prisma errors instead of swallowing them', async () => {
      prisma.contract.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.softDelete(USER_ID, CONTRACT_ID)).rejects.toThrow(
        'db down',
      );
    });
  });
});
