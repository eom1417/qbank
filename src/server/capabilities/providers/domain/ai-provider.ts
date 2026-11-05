import { z } from 'zod';
import type { AiOutcomeStatus } from '../../../../contracts/providers.js';

/** A part of the user's own material sent with a task: page text or a page image. */
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: 'image/png' | 'image/jpeg'; base64: string };

export interface StructuredRequest<T> {
  /** Schema name sent to the provider (letters, digits, underscores). */
  name: string;
  system: string;
  parts: readonly ContentPart[];
  schema: z.ZodType<T>;
  /** May search and read the web for sources (a study note, DEC-34); nothing else ever runs. */
  research?: boolean;
}

export type AiFailure = Exclude<AiOutcomeStatus, 'unchecked' | 'ready'> | 'invalid_output';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StructuredResult<T> =
  { ok: true; value: T; usage: TokenUsage | null } | { ok: false; failure: AiFailure };

/**
 * The only way the product talks to a model (FR-08-010): no vendor is hard-wired. Today the one
 * adapter is a provider instance of the AI providers kit (the user's own subscription or key,
 * DEC-30); tests use recorded replies.
 */
export interface AiProvider {
  generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

/**
 * Model output is untrusted data: it must be JSON and match the schema exactly, or it is
 * rejected as a whole. Nothing from a rejected answer is stored.
 */
export function parseModelOutput<T>(raw: string, schema: z.ZodType<T>): T | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
