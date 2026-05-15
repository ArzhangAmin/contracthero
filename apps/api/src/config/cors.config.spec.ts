import { Logger } from '@nestjs/common';
import { buildCorsOptions } from './cors.config';

const buildSilentLogger = (): Logger => {
  const logger = new Logger('test');
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  return logger;
};

describe('buildCorsOptions', () => {
  it('parses a comma-separated allow-list and enables credentials', () => {
    const opts = buildCorsOptions(
      {
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
      } as NodeJS.ProcessEnv,
      buildSilentLogger(),
    );

    expect(opts.origin).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
    expect(opts.credentials).toBe(true);
  });

  it('never returns wildcard origin alongside credentials', () => {
    const opts = buildCorsOptions(
      {
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example.com',
      } as NodeJS.ProcessEnv,
      buildSilentLogger(),
    );

    expect(opts.origin).not.toBe('*');
    expect(opts.origin).not.toContain('*');
  });

  it('fails closed in production when CORS_ORIGINS is unset', () => {
    const logger = buildSilentLogger();
    const opts = buildCorsOptions(
      { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
      logger,
    );

    expect(opts.origin).toBe(false);
    expect(opts.credentials).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falls back to localhost:3000 in development when CORS_ORIGINS is unset', () => {
    const opts = buildCorsOptions(
      { NODE_ENV: 'development' } as NodeJS.ProcessEnv,
      buildSilentLogger(),
    );

    expect(opts.origin).toEqual(['http://localhost:3000']);
    expect(opts.credentials).toBe(true);
  });

  it('ignores empty entries and whitespace', () => {
    const opts = buildCorsOptions(
      {
        NODE_ENV: 'development',
        CORS_ORIGINS: ' , https://a.test , ,https://b.test, ',
      } as NodeJS.ProcessEnv,
      buildSilentLogger(),
    );

    expect(opts.origin).toEqual(['https://a.test', 'https://b.test']);
  });
});
