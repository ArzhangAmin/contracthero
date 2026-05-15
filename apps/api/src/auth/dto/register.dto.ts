import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../constants';
import { MaxByteLength } from '../validators/max-byte-length.validator';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email!: string;

  @ApiProperty({
    example: 'StrongPass123',
    description:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit. Maximum length is enforced in UTF-8 bytes (bcrypt input cap).',
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  @Matches(PASSWORD_PATTERN, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_NAME_LENGTH)
  name!: string;

  @ApiProperty({ enum: Locale, required: false, default: Locale.DE })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
