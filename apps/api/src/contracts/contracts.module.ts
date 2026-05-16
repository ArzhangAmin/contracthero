import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

/**
 * Contracts module.
 *
 * Imports AuthModule so the controller can apply JwtAuthGuard / @CurrentUser
 * without each consumer having to re-register the JWT strategy.
 *
 * Exports ContractsService so the upcoming Deadline Engine (Sprint 3.2) can
 * inject it without reaching into PrismaService directly.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
