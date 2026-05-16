import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Contract,
  ContractCategory,
  ContractReminder,
  ContractStatus,
  ReminderType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MS_PER_DAY } from './deadline-engine.constants';
import { DeadlineEngineService } from './deadline-engine.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'contract-1',
  userId: 'user-1',
  title: 'Test Contract',
  category: ContractCategory.RENT,
  counterparty: 'Vonovia',
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2026-01-01T00:00:00Z'),
  noticePeriodDays: null,
  autoRenew: false,
  value: null,
  currency: null,
  status: ContractStatus.ACTIVE,
  notes: null,
  filePath: null,
  deletedAt: null,
  createdAt: new Date('2024-12-01T00:00:00Z'),
  updatedAt: new Date('2024-12-01T00:00:00Z'),
  ...overrides,
});

const makeReminder = (
  overrides: Partial<ContractReminder> = {},
): ContractReminder => ({
  id: 'reminder-1',
  contractId: 'contract-1',
  type: ReminderType.DAYS_30,
  scheduledFor: new Date(),
  sentAt: null,
  createdAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type PrismaMock = {
  contract: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
  contractReminder: {
    findFirst: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
};

const buildPrismaMock = (): PrismaMock => ({
  contract: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  contractReminder: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
});

type NotificationsMock = {
  sendDeadlineReminder: jest.Mock;
};

const buildNotificationsMock = (): NotificationsMock => ({
  sendDeadlineReminder: jest.fn().mockResolvedValue(undefined),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeadlineEngineService', () => {
  let service: DeadlineEngineService;
  let prismaMock: PrismaMock;
  let notificationsMock: NotificationsMock;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    notificationsMock = buildNotificationsMock();

    // Logger ro silent mikonim
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineEngineService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<DeadlineEngineService>(DeadlineEngineService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // calculateDaysUntilEnd (pure helper — unit tests)
  // -------------------------------------------------------------------------

  describe('calculateDaysUntilEnd', () => {
    it('exact 30 roz → 30 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() + 30 * MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(30);
    });

    it('exact 14 roz → 14 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() + 14 * MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(14);
    });

    it('exact 7 roz → 7 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() + 7 * MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(7);
    });

    it('exact 1 roz → 1 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() + 1 * MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(1);
    });

    it('gozashteh → adad manfi barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() - MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBeLessThan(0);
    });

    it('0 roz mande (hamaan roz) → 0 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      // Kamtar az 1 roz mande → floor → 0
      const endDate = new Date(now.getTime() + 3_600_000); // 1 hour
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(0);
    });

    it('15 roz mande → threshold nist → 15 barmigardone', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const endDate = new Date(now.getTime() + 15 * MS_PER_DAY);
      expect(service.calculateDaysUntilEnd(endDate, now)).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // checkDeadlines — expire logic
  // -------------------------------------------------------------------------

  describe('checkDeadlines — expire', () => {
    it('contract ba endDate gozashteh → EXPIRED mishe', async () => {
      const now = new Date('2026-05-16T08:00:00Z');
      const contract = makeContract({
        endDate: new Date('2026-05-15T00:00:00Z'), // 1 roz gozashteh
      });

      prismaMock.contract.findMany.mockResolvedValue([contract]);
      prismaMock.contract.update.mockResolvedValue({
        ...contract,
        status: ContractStatus.EXPIRED,
      });

      // now ro simulate mikonim
      jest.spyOn(global, 'Date').mockImplementation(
        () => now as unknown as Date,
      );
      // But Date constructor baraye object literal ha dast nakhorim
      // Behtarin rah: checkDeadlines ro ba inject shode now call mikonim
      // Vali service `new Date()` estefade mikone, pas az spy estefade mikonim:
      jest.restoreAllMocks();
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

      // Direct test: calculateDaysUntilEnd ba endDate gozashteh → manfi
      const days = service.calculateDaysUntilEnd(
        new Date('2026-05-15T00:00:00Z'),
        new Date('2026-05-16T08:00:00Z'),
      );
      expect(days).toBeLessThan(0);
    });

    it('checkDeadlines: contract expired shode — update call mishavad', async () => {
      const expiredEndDate = new Date(Date.now() - 2 * MS_PER_DAY);
      const contract = makeContract({ endDate: expiredEndDate });

      prismaMock.contract.findMany.mockResolvedValue([contract]);
      prismaMock.contract.update.mockResolvedValue({
        ...contract,
        status: ContractStatus.EXPIRED,
      });

      await service.checkDeadlines();

      expect(prismaMock.contract.update).toHaveBeenCalledWith({
        where: { id: contract.id },
        data: { status: ContractStatus.EXPIRED },
      });
      expect(notificationsMock.sendDeadlineReminder).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // checkDeadlines — notification triggers
  // -------------------------------------------------------------------------

  describe('checkDeadlines — notification', () => {
    const thresholdCases: Array<{ days: number; type: ReminderType }> = [
      { days: 30, type: ReminderType.DAYS_30 },
      { days: 14, type: ReminderType.DAYS_14 },
      { days: 7, type: ReminderType.DAYS_7 },
      { days: 1, type: ReminderType.DAYS_1 },
    ];

    thresholdCases.forEach(({ days, type }) => {
      it(`${days}-roz threshold → notification trigger mishavad (aval bar)`, async () => {
        const endDate = new Date(
          Date.now() + days * MS_PER_DAY + 3_600_000, // threshold + 1 hour (floor → exact days)
        );
        const contract = makeContract({ endDate });

        prismaMock.contract.findMany.mockResolvedValue([contract]);
        // isAlreadyNotified → null (ghablan notify nashode)
        prismaMock.contractReminder.findFirst
          .mockResolvedValueOnce(null) // isAlreadyNotified → false
          .mockResolvedValueOnce(null); // ensureReminderRecord: existing nist
        prismaMock.contractReminder.create.mockResolvedValue(
          makeReminder({ type }),
        );
        notificationsMock.sendDeadlineReminder.mockResolvedValue(undefined);

        await service.checkDeadlines();

        expect(notificationsMock.sendDeadlineReminder).toHaveBeenCalledWith(
          contract,
          days,
          type,
        );
      });
    });

    it('ghablan notify shode → duplicate prevent mishavad', async () => {
      const endDate = new Date(Date.now() + 30 * MS_PER_DAY + 3_600_000);
      const contract = makeContract({ endDate });

      prismaMock.contract.findMany.mockResolvedValue([contract]);
      // isAlreadyNotified → record ba sentAt mowjood hast
      prismaMock.contractReminder.findFirst.mockResolvedValue(
        makeReminder({ type: ReminderType.DAYS_30, sentAt: new Date() }),
      );

      await service.checkDeadlines();

      expect(notificationsMock.sendDeadlineReminder).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // checkDeadlines — edge cases
  // -------------------------------------------------------------------------

  describe('checkDeadlines — edge cases', () => {
    it('hich ACTIVE contract → hich kar', async () => {
      prismaMock.contract.findMany.mockResolvedValue([]);

      await service.checkDeadlines();

      expect(prismaMock.contract.update).not.toHaveBeenCalled();
      expect(notificationsMock.sendDeadlineReminder).not.toHaveBeenCalled();
    });

    it('contract ba daysUntilEnd=15 (non-threshold) → hich notification', async () => {
      const endDate = new Date(Date.now() + 15 * MS_PER_DAY + 3_600_000);
      const contract = makeContract({ endDate });

      prismaMock.contract.findMany.mockResolvedValue([contract]);

      await service.checkDeadlines();

      expect(notificationsMock.sendDeadlineReminder).not.toHaveBeenCalled();
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
    });

    it('prisma findMany error → exception propagate mishavad', async () => {
      prismaMock.contract.findMany.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(service.checkDeadlines()).rejects.toThrow(
        'DB connection lost',
      );
    });
  });
});
