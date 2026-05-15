import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthOutcome, AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  FIFTEEN_MINUTES_MS,
  REFRESH_TOKEN_COOKIE,
  SEVEN_DAYS_MS,
} from './constants/auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResponse } from './types/auth.types';

const PRODUCTION_ENV = 'production';

interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User registered successfully' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const outcome = await this.authService.register(dto);
    this.setAuthCookies(res, outcome);
    return { user: outcome.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login an existing user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'User logged in successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const outcome = await this.authService.login(dto);
    this.setAuthCookies(res, outcome);
    return { user: outcome.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tokens refreshed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const outcome = await this.authService.refresh(token);
    this.setAuthCookies(res, outcome);
    return { user: outcome.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout the current user' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Logged out' })
  logout(@Res({ passthrough: true }) res: Response): void {
    const options = this.buildCookieOptions();
    res.clearCookie(ACCESS_TOKEN_COOKIE, options);
    res.clearCookie(REFRESH_TOKEN_COOKIE, options);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current user' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  me(@CurrentUser() user: AuthUserDto): AuthResponse {
    return { user };
  }

  private setAuthCookies(res: Response, outcome: AuthOutcome): void {
    const baseOptions = this.buildCookieOptions();
    res.cookie(ACCESS_TOKEN_COOKIE, outcome.accessToken, {
      ...baseOptions,
      maxAge: FIFTEEN_MINUTES_MS,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, outcome.refreshToken, {
      ...baseOptions,
      maxAge: SEVEN_DAYS_MS,
    });
  }

  private buildCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === PRODUCTION_ENV;
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    };
  }
}
