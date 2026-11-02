import { z } from 'zod';
import type { ReadinessStatus } from '../../../../contracts/ai.js';

/** A part of the user's own material sent with a task: page text or a page image. */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: 'image/png' | 'image/jpeg'; base64: string };

export interface StructuredRequest<T> {
  /** Schema name sent to the provider (letters, digits, underscores). */
  name: string;
  system: string;
  parts: readonly ContentPart[];
  schema: z.ZodType<T>;
}

export type AiFailure = Exclude<ReadinessStatus, 'unchecked' | 'ready'> | 'invalid_output';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StructuredResult<T> =
  { ok: true; value: T; usage: TokenUsage | null } | { ok: false; failure: AiFailure };

/**
 * The only way the product talks to a model (FR-08-010): no vendor is hard-wired. Adapters:
 * OpenAI-compatible HTTP (local Ollama/llama.cpp first, cloud later) and recorded fixtures.
 */
export interface AiProvider {
  /** Free check: is the server reachable, the key accepted and the model present? */
  checkReadiness(): Promise<ReadinessStatus>;
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
