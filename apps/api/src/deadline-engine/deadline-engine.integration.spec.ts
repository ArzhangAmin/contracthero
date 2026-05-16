/**
 * Integration test baraye DeadlineEngineService.
 *
 * Az real NestJS module graph estefade mikone (testing module),
 * vali Prisma ro mock mikone ta niyaz be DB nabashad.
 *
 * Test scenario haye asal:
 * 1. Cron tick → contract EXPIRED mishe
 * 2. Cron tick → 30-roz reminder trigger mishavad (aval bar)
 * 3. Cron tick → duplicate prevented mishavad (ham bar dovvom)
 * 4. Multi-contract: expire + notify dar yek run
 */

import { Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { DeadlineEngineModule } from './deadline-engine.module';
import { DeadlineEngineService } from './deadline-engine.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'contract-1',
  userId: 'user-1',
  title: 'Integration Test Contract',
  category: ContractCategory.RENT,
  counterparty: 'Test GmbH',
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2026-12-31T00:00:00Z'),
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
// Mock factories
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

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('DeadlineEngineService — integration', () => {
  let module: TestingModule;
  let service: DeadlineEngineService;
  let prismaMock: PrismaMock;
  let notificationsSpy: jest.SpyInstance;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    module = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        DeadlineEngineService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: NotificationsService,
          useValue: {
            sendDeadlineReminder: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DeadlineEngineService>(DeadlineEngineService);
    const notificationsService =
      module.get<NotificationsService>(NotificationsService);
    notificationsSpy = jest.spyOn(
      notificationsService,
      'sendDeadlineReminder',
    );
  });

  afterEach(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Contract expire
  // -------------------------------------------------------------------------

  it('Scenario 1: cron tick → expired contract → status EXPIRED set mishavad', async () => {
    const expiredContract = makeContract({
      id: 'expired-1',
      endDate: new Date(Date.now() - 2 * MS_PER_DAY), // 2 roz pish
    });

    prismaMock.contract.findMany.mockResolvedValue([expiredContract]);
    prismaMock.contract.update.mockResolvedValue({
      ...expiredContract,
      status: ContractStatus.EXPIRED,
    });

    await service.checkDeadlines();

    expect(prismaMock.contract.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.contract.update).toHaveBeenCalledWith({
      where: { id: 'expired-1' },
      data: { status: ContractStatus.EXPIRED },
    });
    expect(notificationsSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: 30-roz reminder — aval bar
  // -------------------------------------------------------------------------

  it('Scenario 2: cron tick → 30-roz threshold → sendDeadlineReminder call mishavad', async () => {
    const endDate = new Date(Date.now() + 30 * MS_PER_DAY + 3_600_000);
    const contract = makeContract({ id: 'remind-30', endDate });

    prismaMock.contract.findMany.mockResolvedValue([contract]);
    // isAlreadyNotified → null (ghablan notify nashode)
    prismaMock.contractReminder.findFirst
      .mockResolvedValueOnce(null) // isAlreadyNotified check
      .mockResolvedValueOnce(null); // ensureReminderRecord: existing nist
    prismaMock.contractReminder.create.mockResolvedValue(
      makeReminder({ contractId: 'remind-30', type: ReminderType.DAYS_30 }),
    );

    await service.checkDeadlines();

    expect(notificationsSpy).toHaveBeenCalledTimes(1);
    expect(notificationsSpy).toHaveBeenCalledWith(
      contract,
      30,
      ReminderType.DAYS_30,
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Duplicate prevention
  // -------------------------------------------------------------------------

  it('Scenario 3: cron tick dovvom → ghablan notify shode → duplicate prevent', async () => {
    const endDate = new Date(Date.now() + 14 * MS_PER_DAY + 3_600_000);
    const contract = makeContract({ id: 'remind-14', endDate });

    prismaMock.contract.findMany.mockResolvedValue([contract]);
    // isAlreadyNotified → record ba sentAt mowjood
    prismaMock.contractReminder.findFirst.mockResolvedValue(
      makeReminder({
        contractId: 'remind-14',
        type: ReminderType.DAYS_14,
        sentAt: new Date(),
      }),
    );

    await service.checkDeadlines();

    expect(notificationsSpy).not.toHaveBeenCalled();
    expect(prismaMock.contract.update).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Multi-contract mixed
  // -------------------------------------------------------------------------

  it('Scenario 4: multi-contract → expired + notify dar yek run', async () => {
    const expiredContract = makeContract({
      id: 'c-expired',
      endDate: new Date(Date.now() - MS_PER_DAY),
    });
    const c7 = makeContract({
      id: 'c-7',
      endDate: new Date(Date.now() + 7 * MS_PER_DAY + 3_600_000),
    });
    const c15 = makeContract({
      id: 'c-15',
      endDate: new Date(Date.now() + 15 * MS_PER_DAY + 3_600_000),
    });

    prismaMock.contract.findMany.mockResolvedValue([expiredContract, c7, c15]);
    prismaMock.contract.update.mockResolvedValue({
      ...expiredContract,
      status: ContractStatus.EXPIRED,
    });

    // c7: not yet notified
    prismaMock.contractReminder.findFirst
      .mockResolvedValueOnce(null) // isAlreadyNotified c7 → false
      .mockResolvedValueOnce(null); // ensureReminderRecord c7 → create
    prismaMock.contractReminder.create.mockResolvedValue(
      makeReminder({ contractId: 'c-7', type: ReminderType.DAYS_7 }),
    );

    await service.checkDeadlines();

    // expired → update
    expect(prismaMock.contract.update).toHaveBeenCalledWith({
      where: { id: 'c-expired' },
      data: { status: ContractStatus.EXPIRED },
    });

    // c7 → notification
    expect(notificationsSpy).toHaveBeenCalledWith(c7, 7, ReminderType.DAYS_7);

    // c15 → hich kar (non-threshold)
    expect(notificationsSpy).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Hame 4 threshold — isolated test
  // -------------------------------------------------------------------------

  const allThresholds: Array<{ days: number; type: ReminderType }> = [
    { days: 30, type: ReminderType.DAYS_30 },
    { days: 14, type: ReminderType.DAYS_14 },
    { days: 7, type: ReminderType.DAYS_7 },
    { days: 1, type: ReminderType.DAYS_1 },
  ];

  allThresholds.forEach(({ days, type }) => {
    it(`Scenario 5.${days}: ${days}-roz threshold — full flow`, async () => {
      const endDate = new Date(Date.now() + days * MS_PER_DAY + 3_600_000);
      const contract = makeContract({ id: `c-${days}`, endDate });

      prismaMock.contract.findMany.mockResolvedValue([contract]);
      prismaMock.contractReminder.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.contractReminder.create.mockResolvedValue(
        makeReminder({ contractId: `c-${days}`, type }),
      );

      await service.checkDeadlines();

      expect(notificationsSpy).toHaveBeenCalledWith(contract, days, type);
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Contract bedune endDate (schema-level nullable edge case)
  // -------------------------------------------------------------------------

  it('Scenario 6: contract ba endDate=null → skip mishavad', async () => {
    const contractNoEnd = makeContract({
      id: 'c-no-end',
      endDate: null as unknown as Date,
    });

    prismaMock.contract.findMany.mockResolvedValue([contractNoEnd]);

    await service.checkDeadlines();

    expect(notificationsSpy).not.toHaveBeenCalled();
    expect(prismaMock.contract.update).not.toHaveBeenCalled();
  });
});
