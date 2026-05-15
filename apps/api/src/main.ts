import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './auth/constants/auth.constants';
import { buildCorsOptions } from './config/cors.config';

const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Explicit allow-list + credentials. Browsers reject `Access-Control-Allow-Origin: *`
  // when `credentials: true`, so we must enumerate origins via CORS_ORIGINS.
  app.enableCors(buildCorsOptions(process.env, new Logger('Cors')));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ContractHero API')
    .setVersion('1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .addCookieAuth(REFRESH_TOKEN_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  await app.listen(port);
}

bootstrap();
