import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { BCRYPT_MAX_PASSWORD_BYTES } from './constants';
import {
  BCRYPT_SALT_ROUNDS,
  DEFAULT_ACCESS_EXPIRES_IN,
  DEFAULT_REFRESH_EXPIRES_IN,
  TOKEN_TYPE_ACCESS,
  TOKEN_TYPE_REFRESH,
} from './constants/auth.constants';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

const PRISMA_UNIQUE_CONSTRAINT_ERROR = 'P2002';
const UTF8_ENCODING = 'utf8';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthOutcome extends TokenPair {
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthOutcome> {
    this.assertBcryptCompatiblePassword(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    let user: User;
    try {
      user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        name: dto.name,
        locale: dto.locale,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthUserDto(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthOutcome> {
    // For login, an oversized password must NOT succeed via bcrypt's silent
    // truncation. We treat it as invalid credentials (not BadRequest) to
    // avoid leaking length information to attackers probing the boundary.
    if (this.exceedsBcryptInputLimit(dto.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthUserDto(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthOutcome> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== TOKEN_TYPE_REFRESH) {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthUserDto(user), ...tokens };
  }

  async validateAccessUser(payload: JwtPayload): Promise<AuthUserDto> {
    if (payload.typ !== TOKEN_TYPE_ACCESS) {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toAuthUserDto(user);
  }

  /**
   * Defense-in-depth: even though DTOs enforce the byte cap, refuse to hash
   * any password whose UTF-8 byte length exceeds bcrypt's 72-byte input
   * limit. Without this guard, two distinct passwords sharing the same
   * 72-byte prefix would collide on hash, both authenticating against the
   * same account.
   */
  private assertBcryptCompatiblePassword(password: string): void {
    if (this.exceedsBcryptInputLimit(password)) {
      throw new BadRequestException(
        `password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes when encoded as UTF-8`,
      );
    }
  }

  private exceedsBcryptInputLimit(password: string): boolean {
    return (
      Buffer.byteLength(password, UTF8_ENCODING) > BCRYPT_MAX_PASSWORD_BYTES
    );
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      DEFAULT_ACCESS_EXPIRES_IN;
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      DEFAULT_REFRESH_EXPIRES_IN;

    const basePayload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, typ: TOKEN_TYPE_ACCESS },
      { expiresIn: accessExpiresIn },
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, typ: TOKEN_TYPE_REFRESH },
      { expiresIn: refreshExpiresIn },
    );

    return { accessToken, refreshToken };
  }

  private toAuthUserDto(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      createdAt: user.createdAt,
    };
  }
}
