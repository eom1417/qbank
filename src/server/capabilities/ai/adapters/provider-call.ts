import type { z } from 'zod';
import {
  parseModelOutput,
  type AiFailure,
  type StructuredResult,
  type TokenUsage,
} from '../domain/ai-provider.js';

/** Where and how to reach the user's provider; shared by every HTTP adapter. */
export interface Endpoint {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** Re-checks the URL right before each call (DNS can change after the URL was saved). */
  isAllowed(url: string): Promise<boolean>;
  fetch?: typeof fetch;
}

/** Transport and provider refusals; `invalid_output` only comes from reading a reply. */
export type CallFailure = Exclude<AiFailure, 'invalid_output'>;

export const CHECK_TIMEOUT_MS = 10_000;
// Reading a full page (or its image) can take a large model a few minutes.
export const GENERATE_TIMEOUT_MS = 300_000;

/** The one way a model reply becomes a result: it must be the requested JSON, or nothing. */
export function structuredResult<T>(
  text: string | null | undefined,
  schema: z.ZodType<T>,
  usage: TokenUsage | null,
): StructuredResult<T> {
  const value = text ? parseModelOutput(text, schema) : null;
  return value === null ? { ok: false, failure: 'invalid_output' } : { ok: true, value, usage };
}
