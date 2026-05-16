import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractCategory, ContractStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CURRENCY_CODE_LENGTH,
  MAX_COUNTERPARTY_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_NOTICE_PERIOD_DAYS,
  MAX_TITLE_LENGTH,
  MIN_NOTICE_PERIOD_DAYS,
  VALUE_MAX_DECIMAL_PLACES,
} from '../constants/contracts.constants';
import { IsAfter } from '../validators/end-after-start.validator';

const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreateContractDto {
  @ApiProperty({ example: 'Apartment Lease — Berlin Mitte', maxLength: MAX_TITLE_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @ApiProperty({ enum: ContractCategory })
  @IsEnum(ContractCategory)
  category!: ContractCategory;

  @ApiProperty({ example: 'Vonovia SE', maxLength: MAX_COUNTERPARTY_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COUNTERPARTY_LENGTH)
  counterparty!: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z', type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsAfter('startDate')
  endDate!: Date;

  @ApiPropertyOptional({ example: 90, minimum: MIN_NOTICE_PERIOD_DAYS, maximum: MAX_NOTICE_PERIOD_DAYS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_NOTICE_PERIOD_DAYS)
  @Max(MAX_NOTICE_PERIOD_DAYS)
  noticePeriodDays?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({ example: 1250.5, description: 'Monetary value (max 2 decimal places).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: VALUE_MAX_DECIMAL_PLACES, allowNaN: false, allowInfinity: false })
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 'EUR', description: 'ISO 4217 currency code (3 uppercase letters).' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @MaxLength(CURRENCY_CODE_LENGTH)
  @MinLength(CURRENCY_CODE_LENGTH)
  @Matches(ISO_CURRENCY_PATTERN, {
    message: 'currency must be a 3-letter ISO 4217 code',
  })
  currency?: string;

  @ApiPropertyOptional({ enum: ContractStatus, default: ContractStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ maxLength: MAX_NOTES_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string;
}
