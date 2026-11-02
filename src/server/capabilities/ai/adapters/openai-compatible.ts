import { z } from 'zod';
import type { ReadinessStatus } from '../../../../contracts/ai.js';
import {
  parseModelOutput,
  type AiFailure,
  type AiProvider,
  type ContentPart,
  type StructuredRequest,
  type StructuredResult,
} from '../domain/ai-provider.js';

interface Endpoint {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** Re-checks the URL right before each call (DNS can change after the URL was saved). */
  isAllowed(url: string): Promise<boolean>;
  fetch?: typeof fetch;
}

/** Transport and provider refusals; `invalid_output` only comes from reading a completion. */
type CallFailure = Exclude<AiFailure, 'invalid_output'>;

const CHECK_TIMEOUT_MS = 10_000;
// Small local models on a CPU-only host can take minutes for one page.
const GENERATE_TIMEOUT_MS = 300_000;

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

async function checkReadiness(endpoint: Endpoint): Promise<ReadinessStatus> {
  const outcome = await call(endpoint, '/models', CHECK_TIMEOUT_MS);
  if (!outcome.ok) return outcome.failure;
  const list = ModelList.safeParse(outcome.json);
  if (!list.success) return 'unexpected';
  return list.data.data.some((entry) => entry.id === endpoint.model) ? 'ready' : 'model_missing';
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
  const content = completion.data.choices[0]?.message.content;
  const value = content ? parseModelOutput(content, request.schema) : null;
  if (value === null) return { ok: false, failure: 'invalid_output' };
  const usage = completion.data.usage;
  const tokens = usage && {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  };
  return { ok: true, value, usage: tokens ?? null };
}

export const createOpenAiCompatibleProvider = (endpoint: Endpoint): AiProvider => ({
  checkReadiness: () => checkReadiness(endpoint),
  generate: (request) => generate(endpoint, request),
});
