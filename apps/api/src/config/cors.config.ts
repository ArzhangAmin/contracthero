import { Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const PRODUCTION_ENV = 'production';
const DEV_DEFAULT_ORIGIN = 'http://localhost:3000';
const ORIGIN_SEPARATOR = ',';
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * Builds CORS options from the environment.
 *
 * Rules:
 *  - `CORS_ORIGINS` is a comma-separated allow-list of exact origins.
 *  - We never combine a wildcard `*` with `credentials: true`. Browsers reject
 *    that combination, and it would also widen our CSRF surface to any site.
 *  - In production, an empty allow-list is fail-closed (no origins permitted);
 *    a warning is logged so operators can spot the misconfiguration.
 *  - In non-production environments, the local Next.js dev origin is used as
 *    a sane default to keep DX working without env tweaks.
 */
export function buildCorsOptions(
  env: NodeJS.ProcessEnv,
  logger: Logger = new Logger('Cors'),
): CorsOptions {
  const isProduction = env.NODE_ENV === PRODUCTION_ENV;
  const origins = parseOrigins(env.CORS_ORIGINS);

  if (origins.length === 0) {
    if (isProduction) {
      logger.warn(
        'CORS_ORIGINS is empty in production — all cross-origin browser requests will be blocked.',
      );
      return { origin: false, credentials: true, methods: ALLOWED_METHODS };
    }
    return {
      origin: [DEV_DEFAULT_ORIGIN],
      credentials: true,
      methods: ALLOWED_METHODS,
    };
  }

  return { origin: origins, credentials: true, methods: ALLOWED_METHODS };
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(ORIGIN_SEPARATOR)
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
