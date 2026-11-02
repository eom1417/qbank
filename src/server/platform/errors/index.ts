import type { ErrorCode } from '../../../contracts/errors.js';

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden_origin: 403,
  not_found: 404,
  email_taken: 409,
  payload_too_large: 413,
  internal: 500,
};

/** The single application error type; mapped to HTTP only at the boundary. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(code: ErrorCode, fields?: Record<string, string>) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }

  get httpStatus(): number {
    return STATUS[this.code];
  }
}

/** Neutral "missing or not yours" error: never reveals that another account's object exists. */
export const notFound = (): AppError => new AppError('not_found');
