import { z } from 'zod';
import {
  parseModelOutput,
  type AiFailure,
  type AiProvider,
  type StructuredRequest,
  type StructuredResult,
} from '../../capabilities/providers/domain/ai-provider.js';

/**
 * Bench-only `AiProvider` over the Anthropic Messages API (raw `fetch`, no SDK). Credentials are
 * passed in by the caller; they are never logged. The reply must be JSON matching the request's
 * zod schema, or the call fails as `invalid_output`.
 */
export interface AnthropicCredentials {
  /** Sent as `x-api-key`. Tried first. */
  apiKey?: string | undefined;
  /** Sent as `Authorization: Bearer` (OAuth); used when no key is set or the key is refused. */
  authToken?: string | undefined;
  /** Defaults to https://api.anthropic.com. */
  baseUrl?: string | undefined;
}

export interface AnthropicOptions {
  model: string;
  credentials: AnthropicCredentials;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** Constrain the reply with `output_config.format` (structured outputs). Default true. */
  structuredOutput?: boolean;
  fetchImpl?: typeof fetch;
}

interface ApiReply {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

type Auth = { header: 'key' | 'bearer'; value: string };

const STATUS_FAILURES: Record<number, AiFailure> = {
  401: 'invalid_key',
  402: 'no_quota',
  403: 'no_permission',
  404: 'model_missing',
  429: 'rate_limited',
};

export function failureForStatus(status: number): AiFailure {
  return STATUS_FAILURES[status] ?? 'unexpected';
}

/** JSON Schema for structured outputs: zod's export without the `$schema` marker. */
export function outputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json['$schema'];
  return json;
}

/** Model text with any surrounding ```json fence removed. */
export function stripFence(raw: string): string {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  return fenced ? (fenced[1] ?? '') : text;
}

/** The text blocks of a reply, joined, with any ```json fence removed. */
export function replyText(reply: ApiReply): string {
  return stripFence(
    (reply.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join(''),
  );
}

function headersFor(auth: Auth): Record<string, string> {
  const base = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (auth.header === 'key') return { ...base, 'x-api-key': auth.value };
  return { ...base, authorization: `Bearer ${auth.value}`, 'anthropic-beta': 'oauth-2025-04-20' };
}

function authOrder(credentials: AnthropicCredentials): Auth[] {
  const order: Auth[] = [];
  if (credentials.apiKey) order.push({ header: 'key', value: credentials.apiKey });
  if (credentials.authToken) order.push({ header: 'bearer', value: credentials.authToken });
  return order;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class AnthropicProvider implements AiProvider {
  readonly #options: AnthropicOptions;
  readonly #fetch: typeof fetch;

  constructor(options: AnthropicOptions) {
    this.#options = options;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const auths = authOrder(this.#options.credentials);
    if (auths.length === 0) return { ok: false, failure: 'invalid_key' };
    const body = JSON.stringify(this.#body(request));
    let failure: AiFailure = 'invalid_key';
    for (const auth of auths) {
      const result = await this.#send(body, auth, request.schema);
      if (result.ok || result.failure !== 'invalid_key') return result;
      failure = result.failure;
    }
    return { ok: false, failure };
  }

  #body<T>(request: StructuredRequest<T>): Record<string, unknown> {
    const content = request.parts.map((part) =>
      part.type === 'text'
        ? { type: 'text', text: part.text }
        : { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } },
    );
    const outputConfig: Record<string, unknown> = { effort: this.#options.effort ?? 'low' };
    if (this.#options.structuredOutput !== false) {
      outputConfig['format'] = { type: 'json_schema', schema: outputSchema(request.schema) };
    }
    return {
      model: this.#options.model,
      max_tokens: this.#options.maxTokens ?? 4000,
      system: request.system,
      messages: [{ role: 'user', content }],
      output_config: outputConfig,
    };
  }

  async #send<T>(body: string, auth: Auth, schema: z.ZodType<T>): Promise<StructuredResult<T>> {
    const url = `${this.#options.credentials.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`;
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.#fetch(url, { method: 'POST', headers: headersFor(auth), body });
      } catch {
        return { ok: false, failure: 'unreachable' };
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < 2) {
        await delay(2000 * (attempt + 1));
        continue;
      }
      if (!response.ok) return { ok: false, failure: failureForStatus(response.status) };
      return interpret((await response.json()) as ApiReply, schema);
    }
  }
}

/** A 200 reply to a result: refusals and off-schema text are failures. */
export function interpret<T>(reply: ApiReply, schema: z.ZodType<T>): StructuredResult<T> {
  if (reply.stop_reason === 'refusal') return { ok: false, failure: 'unexpected' };
  const value = parseModelOutput(replyText(reply), schema);
  if (value === null) return { ok: false, failure: 'invalid_output' };
  const usage = reply.usage
    ? { inputTokens: reply.usage.input_tokens ?? 0, outputTokens: reply.usage.output_tokens ?? 0 }
    : null;
  return { ok: true, value, usage };
}
