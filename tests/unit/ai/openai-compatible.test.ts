import { describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatibleProvider } from '../../../src/server/capabilities/ai/adapters/openai-compatible.js';
import { readinessFor } from '../../../src/server/capabilities/ai/domain/ai-provider.js';
import { TrialQuestion } from '../../../src/server/capabilities/ai/domain/trial.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function provider(reply: () => Promise<Response>, apiKey: string | null = 'sk-key-123456789') {
  const fetch = vi.fn(reply);
  const allowed = { value: true };
  const instance = createOpenAiCompatibleProvider({
    baseUrl: 'https://ai.example/v1/',
    apiKey,
    model: 'm1',
    isAllowed: async () => allowed.value,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  return { instance, fetch, allowed };
}

describe('OpenAI-compatible adapter: readiness (FR-08-011)', () => {
  it.each([
    [401, {}, 'invalid_key'],
    [403, {}, 'no_permission'],
    [429, { error: { code: 'insufficient_quota' } }, 'no_quota'],
    [402, {}, 'no_quota'],
    [429, { error: { code: 'rate_limit_exceeded' } }, 'rate_limited'],
    [500, {}, 'unexpected'],
    [200, { data: [{ id: 'other' }] }, 'model_missing'],
    [200, { nonsense: true }, 'unexpected'],
    [200, { data: [{ id: 'm1' }] }, 'ready'],
  ])('HTTP %i %j → %s', async (status, body, expected) => {
    const { instance } = provider(async () => json(status, body));
    expect(readinessFor(await instance.listModels(), 'm1')).toBe(expected);
  });

  it('reports an unreachable server, and never calls a URL the guard refuses', async () => {
    const down = provider(async () => Promise.reject(new TypeError('fetch failed')));
    expect(readinessFor(await down.instance.listModels(), 'm1')).toBe('unreachable');
    const blocked = provider(async () => json(200, { data: [{ id: 'm1' }] }));
    blocked.allowed.value = false;
    expect(readinessFor(await blocked.instance.listModels(), 'm1')).toBe('unreachable');
    expect(blocked.fetch).not.toHaveBeenCalled();
  });

  it('sends the key as a bearer token, refuses redirects, and sends no header without a key', async () => {
    const keyed = provider(async () => json(200, { data: [] }));
    await keyed.instance.listModels();
    const [url, init] = keyed.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.example/v1/models');
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>)['authorization']).toBe(
      'Bearer sk-key-123456789',
    );
    const keyless = provider(async () => json(200, { data: [] }), null);
    await keyless.instance.listModels();
    const [, keylessInit] = keyless.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(keylessInit.headers).not.toHaveProperty('authorization');
  });
});

describe('OpenAI-compatible adapter: structured output', () => {
  const request = { name: 'question', system: 'sys', parts: [], schema: TrialQuestion };
  const answer = { stem: 'Q', options: ['a', 'b'], answer: null };

  it('asks for a strict JSON schema and validates the reply', async () => {
    const reply = {
      choices: [{ message: { content: JSON.stringify(answer) } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    };
    const { instance, fetch } = provider(async () => json(200, reply));
    expect(await instance.generate(request)).toEqual({
      ok: true,
      value: answer,
      usage: { inputTokens: 5, outputTokens: 2 },
    });
    const body = JSON.parse(
      String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.schema.required).toEqual(['stem', 'options', 'answer']);
  });

  it('rejects a reply that is not the requested JSON, and passes refusals through', async () => {
    const prose = { choices: [{ message: { content: 'B, obviously' } }] };
    expect(await provider(async () => json(200, prose)).instance.generate(request)).toEqual({
      ok: false,
      failure: 'invalid_output',
    });
    expect(await provider(async () => json(401, {})).instance.generate(request)).toEqual({
      ok: false,
      failure: 'invalid_key',
    });
  });
});
