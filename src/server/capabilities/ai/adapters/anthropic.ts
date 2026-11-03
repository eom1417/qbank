import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  AiProvider,
  ContentPart,
  ModelListing,
  StructuredRequest,
  StructuredResult,
} from '../domain/ai-provider.js';
import {
  CHECK_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  structuredResult,
  type CallFailure,
  type Endpoint,
} from './provider-call.js';

const MAX_OUTPUT_TOKENS = 16_000;

/**
 * A client bound to the user's own key only. The key is always passed explicitly, so the SDK
 * never falls back to credentials in this server's environment or profiles; every request is
 * re-checked by the SSRF guard and redirects are refused.
 */
function clientFor(endpoint: Endpoint & { apiKey: string }, timeout: number) {
  const guardedFetch: typeof fetch = async (url, init) => {
    const target = url instanceof Request ? url.url : String(url);
    if (!(await endpoint.isAllowed(target))) throw new TypeError('provider address not allowed');
    return (endpoint.fetch ?? fetch)(url, { ...init, redirect: 'error' });
  };
  return new Anthropic({
    apiKey: endpoint.apiKey,
    baseURL: endpoint.baseUrl.replace(/\/+$/, ''),
    fetch: guardedFetch,
    maxRetries: 1,
    timeout,
  });
}

const BY_STATUS: Record<number, CallFailure> = {
  401: 'invalid_key',
  402: 'no_quota',
  403: 'no_permission',
  404: 'model_missing',
  429: 'rate_limited',
  529: 'rate_limited',
};

/** Maps the SDK's typed errors to a reason the user can act on (FR-08-011). */
function classify(error: unknown): CallFailure {
  if (error instanceof Anthropic.APIConnectionError) return 'unreachable';
  if (!(error instanceof Anthropic.APIError) || error.status === undefined) return 'unexpected';
  // An exhausted prepaid balance is reported as a 400 that names the credit balance.
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
    return 'no_quota';
  }
  return BY_STATUS[error.status] ?? 'unexpected';
}

/** Page text and images as Anthropic content blocks (also used by the Claude account adapter). */
export const toAnthropicContent = (parts: readonly ContentPart[]): Anthropic.ContentBlockParam[] =>
  parts.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : {
          type: 'image',
          source: { type: 'base64', media_type: part.mediaType, data: part.base64 },
        },
  );

async function listModels(endpoint: Endpoint): Promise<ModelListing> {
  if (!endpoint.apiKey) return { status: 'invalid_key', models: [] };
  try {
    const models: string[] = [];
    const client = clientFor({ ...endpoint, apiKey: endpoint.apiKey }, CHECK_TIMEOUT_MS);
    for await (const model of client.models.list()) models.push(model.id);
    return { status: 'ready', models };
  } catch (error) {
    return { status: classify(error), models: [] };
  }
}

async function generate<T>(
  endpoint: Endpoint,
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  if (!endpoint.apiKey) return { ok: false, failure: 'invalid_key' };
  let message: Anthropic.Message;
  try {
    message = await clientFor(
      { ...endpoint, apiKey: endpoint.apiKey },
      GENERATE_TIMEOUT_MS,
    ).messages.create({
      model: endpoint.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: request.system,
      messages: [{ role: 'user', content: toAnthropicContent(request.parts) }],
      output_config: { format: { type: 'json_schema', schema: z.toJSONSchema(request.schema) } },
    });
  } catch (error) {
    return { ok: false, failure: classify(error) };
  }
  if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
    return { ok: false, failure: 'invalid_output' };
  }
  const text = message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
  const usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
  return structuredResult(text, request.schema, usage);
}

/** Claude through the official Anthropic SDK (Messages API, structured JSON output). */
export const createAnthropicProvider = (endpoint: Endpoint): AiProvider => ({
  listModels: () => listModels(endpoint),
  generate: (request) => generate(endpoint, request),
});
