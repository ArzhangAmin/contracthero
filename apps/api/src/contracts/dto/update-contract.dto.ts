import { PartialType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto';

/**
 * PATCH /contracts/:id payload. Every field is optional; if both `startDate`
 * and `endDate` are provided, the `IsAfter` validator inherited from
 * `CreateContractDto` enforces `endDate > startDate`. When only one of the
 * two dates is sent, the service layer re-validates against the persisted
 * counterpart so a partial update can never leave the row in an invalid state.
 */
export class UpdateContractDto extends PartialType(CreateContractDto) {}
