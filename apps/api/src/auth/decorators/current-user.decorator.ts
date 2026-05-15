import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { AuthUserDto } from '../dto/auth-user.dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserDto => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthUserDto;
  },
);
