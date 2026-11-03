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

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StructuredResult<T> =
  { ok: true; value: T; usage: TokenUsage | null } | { ok: false; failure: AiFailure };

/** What a provider reported for the key: `ready` with its models, or why it refused. */
export interface ModelListing {
  status: ReadinessStatus;
  models: string[];
}

/**
 * The only way the product talks to a model (FR-08-010): no vendor is hard-wired. The user
 * brings their own provider and key (BYOK). Adapters: OpenAI-compatible HTTP (OpenAI, DeepSeek,
 * Gemini, OpenRouter, any compatible server), the Anthropic Messages API, recorded fixtures.
 */
export interface AiProvider {
  /** Free call: is the API reachable, the key accepted, and which models may it use? */
  listModels(): Promise<ModelListing>;
  generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

/** FR-08-011: ready only when the key works and the chosen model is offered to it. */
export function readinessFor(listing: ModelListing, model: string): ReadinessStatus {
  if (listing.status !== 'ready') return listing.status;
  return listing.models.includes(model) ? 'ready' : 'model_missing';
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
