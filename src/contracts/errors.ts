import { z } from 'zod';

/** Stable machine-readable error codes shared by the API and the SPA. */
export const ErrorCode = z.enum([
  'validation_failed',
  'unauthenticated',
  'invalid_credentials',
  'pairing_required',
  'email_taken',
  'name_taken',
  'invalid_token',
  'not_found',
  'forbidden_origin',
  'payload_too_large',
  'file_unsupported',
  'file_corrupt',
  'file_protected',
  'too_many_pages',
  'approval_required',
  'not_retryable',
  'version_conflict',
  'not_approvable',
  'answers_differ',
  'not_enough_questions',
  'already_answered',
  'nothing_to_retry',
  'exam_ended',
  'question_locked',
  'original_deleted',
  'too_many_attempts',
  'backup_too_new',
  'ai_host_unavailable',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorResponse = z
  .object({
    error: z
      .object({
        code: ErrorCode,
        fields: z.record(z.string(), z.string()).optional(),
      })
      .strict(),
  })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponse>;
