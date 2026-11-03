import { z } from 'zod';
import {
  parseModelOutput,
  type AiProvider,
  type ContentPart,
  type ModelListing,
  type StructuredRequest,
  type StructuredResult,
} from '../domain/ai-provider.js';
import {
  CHECK_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  structuredResult,
  type CallFailure,
  type Endpoint,
} from './provider-call.js';

const ModelList = z.object({ data: z.array(z.object({ id: z.string() })) });
const Completion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

/** Maps a provider's HTTP refusal to a reason the user can act on (FR-08-011). */
function classifyRefusal(status: number, body: string): CallFailure {
  if (status === 401) return 'invalid_key';
  if (status === 403) return 'no_permission';
  if (status === 402 || body.includes('insufficient_quota')) return 'no_quota';
  if (status === 429) return 'rate_limited';
  if (status === 404) return 'model_missing';
  return 'unexpected';
}

const toMessageContent = (parts: readonly ContentPart[]) =>
  parts.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.base64}` } },
  );

type Outcome = { ok: true; json: unknown } | { ok: false; failure: CallFailure };

async function call(
  endpoint: Endpoint,
  path: string,
  timeoutMs: number,
  body?: unknown,
): Promise<Outcome> {
  const url = `${endpoint.baseUrl.replace(/\/+$/, '')}${path}`;
  if (!(await endpoint.isAllowed(url))) return { ok: false, failure: 'unreachable' };
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (endpoint.apiKey) headers['authorization'] = `Bearer ${endpoint.apiKey}`;
  let response: Response;
  try {
    response = await (endpoint.fetch ?? fetch)(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, failure: 'unreachable' };
  }
  const text = await response.text().catch(() => '');
  if (!response.ok) return { ok: false, failure: classifyRefusal(response.status, text) };
  return { ok: true, json: parseModelOutput(text, z.unknown()) };
}

async function listModels(endpoint: Endpoint): Promise<ModelListing> {
  const outcome = await call(endpoint, '/models', CHECK_TIMEOUT_MS);
  if (!outcome.ok) return { status: outcome.failure, models: [] };
  const list = ModelList.safeParse(outcome.json);
  if (!list.success) return { status: 'unexpected', models: [] };
  return { status: 'ready', models: list.data.data.map((entry) => entry.id) };
}

async function generate<T>(
  endpoint: Endpoint,
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  const outcome = await call(endpoint, '/chat/completions', GENERATE_TIMEOUT_MS, {
    model: endpoint.model,
    temperature: 0,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: toMessageContent(request.parts) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: request.name, strict: true, schema: z.toJSONSchema(request.schema) },
    },
  });
  if (!outcome.ok) return outcome;
  const completion = Completion.safeParse(outcome.json);
  if (!completion.success) return { ok: false, failure: 'invalid_output' };
  const usage = completion.data.usage;
  const tokens = usage && {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  };
  return structuredResult(
    completion.data.choices[0]?.message.content,
    request.schema,
    tokens ?? null,
  );
}

export const createOpenAiCompatibleProvider = (endpoint: Endpoint): AiProvider => ({
  listModels: () => listModels(endpoint),
  generate: (request) => generate(endpoint, request),
});
