import { Injectable, Logger } from '@nestjs/common';
import { Contract, ReminderType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * NotificationsService — placeholder baraye Sprint 3.2.
 *
 * Felan notification ro dar DB (ContractReminder.sentAt) record mikone
 * va log mikone. Sprint badi channel haye vaghei (email, push, etc.)
 * implementeshe mishe.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deadline reminder ro record mikone va log mikone.
   * Az `ContractReminder` record ke ghablan besakhte shode estefade mikone
   * ta `sentAt` ro set kone (duplicate prevention dar DeadlineEngineService
   * enajam mishavad, na inja).
   */
  async sendDeadlineReminder(
    contract: Contract,
    daysLeft: number,
    reminderType: ReminderType,
  ): Promise<void> {
    await this.prisma.contractReminder.updateMany({
      where: {
        contractId: contract.id,
        type: reminderType,
        sentAt: null,
      },
      data: { sentAt: new Date() },
    });

    this.logger.log(
      `[Deadline Reminder] contractId=${contract.id} title="${contract.title}" ` +
        `daysLeft=${daysLeft} threshold=${reminderType}`,
    );
  }
}
