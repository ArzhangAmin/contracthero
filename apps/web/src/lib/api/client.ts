/**
 * Thin fetch wrapper used by the web app to talk to the NestJS API.
 *
 * - Always sends cookies (`credentials: 'include'`) so the HTTP-only JWT
 *   cookies set by the API are forwarded on every request.
 * - Returns typed JSON or throws an `ApiError` for non-2xx responses so
 *   callers can branch on `status`/`code` without parsing strings.
 */

const HTTP_STATUS_NO_CONTENT = 204;
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const JSON_CONTENT_TYPE = 'application/json';

export interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const messageOk =
    candidate.message === undefined ||
    typeof candidate.message === 'string' ||
    (Array.isArray(candidate.message) &&
      candidate.message.every((entry) => typeof entry === 'string'));
  const errorOk = candidate.error === undefined || typeof candidate.error === 'string';
  const statusOk =
    candidate.statusCode === undefined || typeof candidate.statusCode === 'number';
  return messageOk && errorOk && statusOk;
}

function extractErrorMessage(body: ApiErrorBody | null, fallback: string): string {
  if (!body) {
    return fallback;
  }
  if (typeof body.message === 'string') {
    return body.message;
  }
  if (Array.isArray(body.message) && body.message.length > 0) {
    return body.message.join(', ');
  }
  if (typeof body.error === 'string') {
    return body.error;
  }
  return fallback;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
  }

  public async request<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    const { method = 'GET', body, signal, headers = {} } = options;

    const init: RequestInit = {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: JSON_CONTENT_TYPE,
        ...headers,
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = {
        ...init.headers,
        'Content-Type': JSON_CONTENT_TYPE,
      };
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, init);

    if (response.status === HTTP_STATUS_NO_CONTENT) {
      return undefined as TResponse;
    }

    const rawBody = await this.safeParseJson(response);

    if (!response.ok) {
      const errorBody = isApiErrorBody(rawBody) ? rawBody : null;
      const message = extractErrorMessage(errorBody, response.statusText);
      throw new ApiError(response.status, message, errorBody);
    }

    return rawBody as TResponse;
  }

  private async safeParseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

export function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

let defaultClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    defaultClient = new ApiClient({ baseUrl: resolveApiBaseUrl() });
  }
  return defaultClient;
}

/** Test-only helper: reset the memoized singleton so each test gets a fresh client. */
export function __resetApiClientForTesting(): void {
  defaultClient = null;
}
