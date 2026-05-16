import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Contract, ContractCategory, ContractStatus } from '@prisma/client';

/**
 * Public, serialization-safe representation of a Contract row.
 *
 * - `value` is exposed as a string because Prisma's `Decimal` type does not
 *   round-trip safely through JavaScript's IEEE-754 `number`. Clients should
 *   parse it with a big-decimal library if they need to do math; for display
 *   the string form preserves the canonical `NUMERIC(14, 2)` precision.
 * - `deletedAt` is intentionally omitted: deleted rows are filtered out at the
 *   query layer and never reach the response.
 */
export class ContractResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ContractCategory })
  category!: ContractCategory;

  @ApiProperty()
  counterparty!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endDate!: Date;

  @ApiPropertyOptional({ nullable: true })
  noticePeriodDays!: number | null;

  @ApiProperty()
  autoRenew!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Decimal value as string.' })
  value!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  currency!: string | null;

  @ApiProperty({ enum: ContractStatus })
  status!: ContractStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(contract: Contract): ContractResponseDto {
    return {
      id: contract.id,
      userId: contract.userId,
      title: contract.title,
      category: contract.category,
      counterparty: contract.counterparty,
      startDate: contract.startDate,
      endDate: contract.endDate,
      noticePeriodDays: contract.noticePeriodDays,
      autoRenew: contract.autoRenew,
      value: contract.value === null ? null : contract.value.toString(),
      currency: contract.currency,
      status: contract.status,
      notes: contract.notes,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }
}
