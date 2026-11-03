import type { z } from 'zod';
import { ErrorResponse, type ErrorCode } from '../../../contracts/errors.js';

/** A failed API call with the server's stable code; 'network' when no response arrived. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'network';
  readonly fields: Record<string, string>;

  constructor(code: ErrorCode | 'network', fields: Record<string, string> = {}) {
    super(code);
    this.code = code;
    this.fields = fields;
  }
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const form = body instanceof FormData;
  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
      // A FormData body (a file upload) sets its own multipart content type.
      headers: body === undefined || form ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? null : form ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network');
  }
}

/** The one HTTP client of the SPA: responses are validated against the shared contracts. */
export async function apiRequest<S extends z.ZodType>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const response = await send(method, path, body);
  const json: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorResponse.safeParse(json);
    if (!parsed.success) throw new ApiError('internal');
    throw new ApiError(parsed.data.error.code, parsed.data.error.fields);
  }
  return schema.parse(json);
}
