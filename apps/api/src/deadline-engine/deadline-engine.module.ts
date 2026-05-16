import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeadlineEngineService } from './deadline-engine.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    NotificationsModule,
  ],
  providers: [DeadlineEngineService],
  exports: [DeadlineEngineService],
})
export class DeadlineEngineModule {}
