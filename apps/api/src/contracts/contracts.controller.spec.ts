import { Test, TestingModule } from '@nestjs/testing';
import {
  Contract,
  ContractCategory,
  ContractStatus,
  Locale,
  Prisma,
} from '@prisma/client';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from './constants/contracts.constants';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts.query.dto';

const USER: AuthUserDto = {
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane',
  locale: Locale.DE,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'contract-1',
  userId: USER.id,
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

const buildCreateDto = (): CreateContractDto => ({
  title: 'Lease',
  category: ContractCategory.RENT,
  counterparty: 'Vonovia',
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2026-01-01T00:00:00Z'),
});

const buildListQuery = (
  overrides: Partial<ListContractsQueryDto> = {},
): ListContractsQueryDto => {
  const q = new ListContractsQueryDto();
  q.page = overrides.page ?? DEFAULT_PAGE;
  q.pageSize = overrides.pageSize ?? DEFAULT_PAGE_SIZE;
  return q;
};

describe('ContractsController', () => {
  let controller: ContractsController;
  let service: jest.Mocked<ContractsService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<ContractsService>> = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findOneForUser: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: serviceMock }],
    }).compile();

    controller = module.get(ContractsController);
    service = module.get(ContractsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('delegates to the service with the caller id and returns the serialized DTO', async () => {
      const created = buildContract();
      service.create.mockResolvedValue(created);

      const result = await controller.create(USER, buildCreateDto());

      expect(service.create).toHaveBeenCalledWith(USER.id, expect.any(Object));
      expect(result.id).toBe(created.id);
      // Decimal must round-trip as a string, never as a number or object.
      expect(typeof result.value).toBe('string');
      expect(result.value).toBe('1250.5');
    });
  });

  describe('findAll', () => {
    it('returns items mapped to DTOs plus pagination metadata', async () => {
      service.findAllForUser.mockResolvedValue({
        items: [buildContract(), buildContract({ id: 'contract-2' })],
        total: 25,
      });

      const result = await controller.findAll(
        USER,
        buildListQuery({ page: 2, pageSize: 10 }),
      );

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      // ceil(25 / 10) = 3
      expect(result.totalPages).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });

    it('reports totalPages = 1 when there are zero rows (never 0, never NaN)', async () => {
      service.findAllForUser.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findAll(USER, buildListQuery());

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.items).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('serializes the entity returned by the service', async () => {
      service.findOneForUser.mockResolvedValue(buildContract());

      const result = await controller.findOne(USER, 'contract-1');

      expect(service.findOneForUser).toHaveBeenCalledWith(USER.id, 'contract-1');
      expect(result.id).toBe('contract-1');
    });
  });

  describe('update', () => {
    it('forwards the partial DTO and returns the updated, serialized contract', async () => {
      const updated = buildContract({ title: 'Updated' });
      service.update.mockResolvedValue(updated);

      const result = await controller.update(USER, 'contract-1', {
        title: 'Updated',
      });

      expect(service.update).toHaveBeenCalledWith(USER.id, 'contract-1', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('calls softDelete and resolves to undefined (204 No Content)', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await expect(controller.remove(USER, 'contract-1')).resolves.toBeUndefined();
      expect(service.softDelete).toHaveBeenCalledWith(USER.id, 'contract-1');
    });
  });
});
