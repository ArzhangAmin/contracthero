import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Contract, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts.query.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const PRISMA_RECORD_NOT_FOUND = 'P2025';

/**
 * Contracts domain service.
 *
 * Ownership invariant: every read, mutation, and delete is scoped by
 * `userId`. We never accept an "ownerless" query — even the soft-delete path
 * uses `updateMany({ where: { id, userId, deletedAt: null } })` so a token
 * for user A cannot touch user B's row even if A guesses B's contract id.
 *
 * Soft delete invariant: `deletedAt IS NOT NULL` rows are filtered out of
 * every read path and treated as non-existent (404) by every mutation path.
 */
@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateContractDto): Promise<Contract> {
    // DTO already enforces endDate > startDate via @IsAfter.
    //
    // We build the `data` object incrementally so that omitted optional
    // fields are NOT serialized as `undefined`. Prisma treats `undefined`
    // as "use the default", but passing it via object spread would still
    // override schema-level `@default(...)` declarations (notably
    // `status` and `autoRenew`). Building incrementally keeps the create
    // path consistent with PATCH semantics.
    const data: Prisma.ContractUncheckedCreateInput = {
      userId,
      title: dto.title,
      category: dto.category,
      counterparty: dto.counterparty,
      startDate: dto.startDate,
      endDate: dto.endDate,
    };
    if (dto.noticePeriodDays !== undefined) {
      data.noticePeriodDays = dto.noticePeriodDays;
    }
    if (dto.autoRenew !== undefined) {
      data.autoRenew = dto.autoRenew;
    }
    if (dto.value !== undefined) {
      data.value = new Prisma.Decimal(dto.value);
    }
    if (dto.currency !== undefined) {
      data.currency = dto.currency;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    return this.prisma.contract.create({ data });
  }

  async findAllForUser(
    userId: string,
    query: ListContractsQueryDto,
  ): Promise<{ items: Contract[]; total: number }> {
    const where = this.buildListWhere(userId, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { items, total };
  }

  async findOneForUser(userId: string, id: string): Promise<Contract> {
    const contract = await this.prisma.contract.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateContractDto,
  ): Promise<Contract> {
    // Load first so we can: (a) enforce ownership + soft-delete invariants
    // with a single error path, and (b) cross-validate dates when only one
    // side of the (startDate, endDate) pair is supplied.
    const existing = await this.findOneForUser(userId, id);

    const nextStart = dto.startDate ?? existing.startDate;
    const nextEnd = dto.endDate ?? existing.endDate;
    if (nextEnd.getTime() <= nextStart.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const data: Prisma.ContractUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.counterparty !== undefined) data.counterparty = dto.counterparty;
    if (dto.startDate !== undefined) data.startDate = dto.startDate;
    if (dto.endDate !== undefined) data.endDate = dto.endDate;
    if (dto.noticePeriodDays !== undefined) data.noticePeriodDays = dto.noticePeriodDays;
    if (dto.autoRenew !== undefined) data.autoRenew = dto.autoRenew;
    if (dto.value !== undefined) data.value = new Prisma.Decimal(dto.value);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.contract.update({
      where: { id: existing.id },
      data,
    });
  }

  /**
   * Soft delete. Sets `deletedAt = now()` atomically and guarded by
   * `(id, userId, deletedAt: null)`. Returns void; callers should respond
   * with 204 No Content.
   *
   * Idempotency note: deleting an already-deleted row returns 404, not 204.
   * This is intentional — we want the caller to know they're operating on a
   * stale view rather than silently masking a bug.
   */
  async softDelete(userId: string, id: string): Promise<void> {
    try {
      const result = await this.prisma.contract.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        throw new NotFoundException('Contract not found');
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_RECORD_NOT_FOUND
      ) {
        throw new NotFoundException('Contract not found');
      }
      throw error;
    }
  }

  private buildListWhere(
    userId: string,
    query: ListContractsQueryDto,
  ): Prisma.ContractWhereInput {
    const where: Prisma.ContractWhereInput = {
      userId,
      deletedAt: null,
    };

    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.category !== undefined) {
      where.category = query.category;
    }
    if (query.search !== undefined && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { counterparty: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
