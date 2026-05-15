import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@prisma/client';

/**
 * Public-safe user representation returned by auth endpoints. Never includes passwordHash.
 */
export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Locale })
  locale!: Locale;

  @ApiProperty()
  createdAt!: Date;
}
