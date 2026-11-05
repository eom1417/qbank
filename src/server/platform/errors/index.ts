import type { ErrorCode } from '../../../contracts/errors.js';

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  pairing_required: 401,
  forbidden_origin: 403,
  not_found: 404,
  email_taken: 409,
  name_taken: 409,
  invalid_token: 400,
  payload_too_large: 413,
  file_unsupported: 415,
  file_corrupt: 422,
  file_protected: 422,
  too_many_pages: 422,
  page_too_large: 422,
  approval_required: 409,
  not_retryable: 409,
  version_conflict: 409,
  not_approvable: 409,
  answers_differ: 409,
  not_enough_questions: 409,
  already_answered: 409,
  nothing_to_retry: 409,
  exam_ended: 409,
  question_locked: 409,
  original_deleted: 409,
  too_many_attempts: 429,
  backup_too_new: 409,
  ai_host_unavailable: 503,
  ai_host_busy: 503,
  channel_paused: 409,
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
