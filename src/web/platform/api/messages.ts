import type { MessageKey } from '../i18n/i18n.js';
import { ApiError } from './client.js';

/** Maps any failure to a translatable, actionable message key. */
export function errorMessageKey(error: unknown): MessageKey {
  return error instanceof ApiError ? `error.${error.code}` : 'error.internal';
}

const FIELD_MESSAGES: Record<string, MessageKey> = {
  too_small: 'field.tooShort',
  too_big: 'field.tooLong',
  invalid_value: 'field.required',
  incorrect: 'field.incorrect',
  taken: 'field.taken',
};

/** Field-level message keys from a validation error, keyed by field name. */
export function fieldMessageKeys(error: unknown): Record<string, MessageKey> {
  if (!(error instanceof ApiError)) return {};
  const keys: Record<string, MessageKey> = {};
  for (const [field, code] of Object.entries(error.fields)) {
    keys[field] = FIELD_MESSAGES[code] ?? 'field.invalid';
  }
  return keys;
}
