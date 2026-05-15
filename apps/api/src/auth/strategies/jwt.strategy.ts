import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { ACCESS_TOKEN_COOKIE } from '../constants/auth.constants';
import { AuthUserDto } from '../dto/auth-user.dto';
import { JwtPayload } from '../types/jwt-payload.type';

const cookieExtractor = (req: Request): string | null => {
  const cookies = req?.cookies as Record<string, string> | undefined;
  if (cookies && typeof cookies[ACCESS_TOKEN_COOKIE] === 'string') {
    return cookies[ACCESS_TOKEN_COOKIE];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    };

    super(options);
  }

  async validate(_req: Request, payload: JwtPayload): Promise<AuthUserDto> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.authService.validateAccessUser(payload);
  }
}
