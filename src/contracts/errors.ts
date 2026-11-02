import { z } from 'zod';

/** Stable machine-readable error codes shared by the API and the SPA. */
export const ErrorCode = z.enum([
  'validation_failed',
  'unauthenticated',
  'invalid_credentials',
  'email_taken',
  'not_found',
  'forbidden_origin',
  'payload_too_large',
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
