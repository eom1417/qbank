import type { z } from 'zod';
import { AppError } from '../errors/index.js';

/** Parses untrusted input against a contract schema; field errors keyed by dotted path. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.code;
  }
  throw new AppError('validation_failed', fields);
}
