import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '../auth/constants/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContractsService } from './contracts.service';
import { ContractResponseDto } from './dto/contract-response.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts.query.dto';
import { PaginatedContractsDto } from './dto/paginated-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const MIN_TOTAL_PAGES = 1;

@ApiTags('contracts')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contract for the current user.' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ContractResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failure' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  async create(
    @CurrentUser() user: AuthUserDto,
    @Body() dto: CreateContractDto,
  ): Promise<ContractResponseDto> {
    const contract = await this.contractsService.create(user.id, dto);
    return ContractResponseDto.fromEntity(contract);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List contracts owned by the current user, paginated and filterable.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedContractsDto })
  async findAll(
    @CurrentUser() user: AuthUserDto,
    @Query() query: ListContractsQueryDto,
  ): Promise<PaginatedContractsDto> {
    const { items, total } = await this.contractsService.findAllForUser(
      user.id,
      query,
    );
    const totalPages = Math.max(
      MIN_TOTAL_PAGES,
      Math.ceil(total / query.pageSize),
    );
    return {
      items: items.map(ContractResponseDto.fromEntity),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single contract by id.' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Contract not found' })
  async findOne(
    @CurrentUser() user: AuthUserDto,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    const contract = await this.contractsService.findOneForUser(user.id, id);
    return ContractResponseDto.fromEntity(contract);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partially update a contract.' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failure' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Contract not found' })
  async update(
    @CurrentUser() user: AuthUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    const contract = await this.contractsService.update(user.id, id, dto);
    return ContractResponseDto.fromEntity(contract);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a contract (sets deletedAt; row is preserved for audit).',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Soft-deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Contract not found' })
  async remove(
    @CurrentUser() user: AuthUserDto,
    @Param('id') id: string,
  ): Promise<void> {
    await this.contractsService.softDelete(user.id, id);
  }
}
