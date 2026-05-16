import { ApiProperty } from '@nestjs/swagger';
import { ContractResponseDto } from './contract-response.dto';

export class PaginatedContractsDto {
  @ApiProperty({ type: [ContractResponseDto] })
  items!: ContractResponseDto[];

  @ApiProperty({ description: 'Total number of (non-deleted) rows matching the filter.' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty({ description: 'ceil(total / pageSize). Always >= 1 (1 even when total == 0).' })
  totalPages!: number;
}
