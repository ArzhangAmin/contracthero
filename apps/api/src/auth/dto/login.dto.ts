import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
} from '../constants';
import { MaxByteLength } from '../validators/max-byte-length.validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email!: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  password!: string;
}
