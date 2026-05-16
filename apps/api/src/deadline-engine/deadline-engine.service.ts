import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Contract, ContractStatus, ReminderType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEADLINE_THRESHOLDS,
  DEFAULT_DEADLINE_CRON,
  MS_PER_DAY,
} from './deadline-engine.constants';

/**
 * DeadlineEngineService
 *
 * Masool baraye:
 * 1. Scan kardan hame ACTIVE contract ha har roz saat 08:00 UTC
 * 2. Expire kardan contract hayi ke endDate gozashteh
 * 3. Trigger kardan deadline reminder ha baraye threshold haye 30/14/7/1 roz
 * 4. Jologiri az duplicate notification ha az tariq ContractReminder records
 */
@Injectable()
export class DeadlineEngineService {
  private readonly logger = new Logger(DeadlineEngineService.name);

  /** Cron schedule az env var ya default (08:00 UTC) */
  private readonly cronSchedule: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    this.cronSchedule =
      process.env.DEADLINE_CRON_SCHEDULE ?? DEFAULT_DEADLINE_CRON;
  }

  /**
   * Entry point ke az cron trigger mishavad.
   * Mothed ro public gozashtim ta dar integration tests doghosti call beshe.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkDeadlines(): Promise<void> {
    this.logger.log(
      `[checkDeadlines] starting — schedule="${this.cronSchedule}"`,
    );

    const now = new Date();

    const activeContracts = await this.fetchActiveContracts();

    this.logger.log(
      `[checkDeadlines] found ${activeContracts.length} ACTIVE contracts`,
    );

    let expired = 0;
    let notified = 0;

    for (const contract of activeContracts) {
      // Skip: endDate moshakhas nist (schema endDate nullable nist vali double-check)
      if (!contract.endDate) {
        continue;
      }

      const daysUntilEnd = this.calculateDaysUntilEnd(contract.endDate, now);

      if (daysUntilEnd < 0) {
        // Contract expire shode
        await this.expireContract(contract);
        expired++;
        continue;
      }

      // Check threshold ha
      for (const threshold of DEADLINE_THRESHOLDS) {
        if (daysUntilEnd === threshold.days) {
          const wasNotified = await this.isAlreadyNotified(
            contract.id,
            threshold.reminderType,
          );

          if (!wasNotified) {
            await this.ensureReminderRecord(
              contract.id,
              threshold.reminderType,
              contract.endDate,
            );
            await this.notifications.sendDeadlineReminder(
              contract,
              threshold.days,
              threshold.reminderType,
            );
            notified++;
          } else {
            this.logger.debug(
              `[checkDeadlines] skip duplicate: contractId=${contract.id} threshold=${threshold.reminderType}`,
            );
          }
          // Har contract faqat ba yek threshold match mikone (exact match)
          break;
        }
      }
    }

    this.logger.log(
      `[checkDeadlines] done — expired=${expired} notified=${notified}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Hame ACTIVE contract haro fetch mikone.
   * DRAFT, TERMINATED, soft-deleted filter mishe.
   */
  private async fetchActiveContracts(): Promise<Contract[]> {
    return this.prisma.contract.findMany({
      where: {
        status: ContractStatus.ACTIVE,
        deletedAt: null,
        endDate: { not: undefined },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  /**
   * Roozha ta endDate ro hesab mikone.
   * Agar endDate gozashteh bashe → adad manfi barmigardad.
   * Hame chiz UTC.
   */
  calculateDaysUntilEnd(endDate: Date, now: Date): number {
    const diffMs = endDate.getTime() - now.getTime();
    return Math.floor(diffMs / MS_PER_DAY);
  }

  /**
   * Contract ro EXPIRED set mikone va log mikone.
   */
  private async expireContract(contract: Contract): Promise<void> {
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: { status: ContractStatus.EXPIRED },
    });
    this.logger.log(
      `[checkDeadlines] expired contractId=${contract.id} title="${contract.title}"`,
    );
  }

  /**
   * Check mikone aya in threshold ghablan notify shode ya na.
   * Az `ContractReminder.sentAt` estefade mikone.
   */
  private async isAlreadyNotified(
    contractId: string,
    reminderType: ReminderType,
  ): Promise<boolean> {
    const existing = await this.prisma.contractReminder.findFirst({
      where: {
        contractId,
        type: reminderType,
        sentAt: { not: null },
      },
    });
    return existing !== null;
  }

  /**
   * ContractReminder record ro misaze age mowjood nabashad.
   * Idempotent: age record ba hamaan type mowjood bashe, dobare nemisaze.
   */
  private async ensureReminderRecord(
    contractId: string,
    reminderType: ReminderType,
    endDate: Date,
  ): Promise<void> {
    const existing = await this.prisma.contractReminder.findFirst({
      where: { contractId, type: reminderType },
    });

    if (!existing) {
      await this.prisma.contractReminder.create({
        data: {
          contractId,
          type: reminderType,
          scheduledFor: endDate,
        },
      });
    }
  }
}
