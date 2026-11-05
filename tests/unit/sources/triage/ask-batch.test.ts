import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AiProvider } from '../../../../src/server/capabilities/providers/index.js';
import type { StructuredResult } from '../../../../src/server/capabilities/providers/domain/ai-provider.js';
import {
  askBatch,
  askInParts,
} from '../../../../src/server/capabilities/sources/use-cases/ask-batch.js';

/** A provider that answers with the given results in order, counting its requests. */
function scripted(...results: StructuredResult<unknown>[]) {
  let asked = 0;
  const provider: AiProvider = {
    generate: <T>() => Promise.resolve(results[asked++] as StructuredResult<T>),
  };
  return { provider, asked: () => asked };
}

const request = { name: 'x', system: 's', parts: [], schema: z.object({ ok: z.boolean() }) };
const ok = { ok: true as const, value: { ok: true }, usage: null };

describe('asking a triage batch', () => {
  it('asks once more after a reply in the wrong shape or a dropped connection', async () => {
    for (const failure of ['invalid_output', 'unreachable'] as const) {
      const ai = scripted({ ok: false, failure }, ok);
      expect(await askBatch(ai.provider, request)).toEqual(ok);
      expect(ai.asked()).toBe(2);
    }
  });

  it('does not ask again after a refusal or an empty quota', async () => {
    const ai = scripted({ ok: false, failure: 'no_quota' }, ok);
    expect(await askBatch(ai.provider, request)).toEqual({ ok: false, failure: 'no_quota' });
    expect(ai.asked()).toBe(1);
  });
});

describe('a batch whose reply stays unreadable', () => {
  const broken = { ok: false as const, failure: 'invalid_output' as const };
  const request = (part: readonly string[]) => ({
    name: 'x',
    system: part.join(),
    parts: [],
    schema: z.object({ ok: z.boolean() }),
  });

  it('is asked again in halves, and a question that stays unreadable is left alone', async () => {
    // The whole batch twice, then [a] twice, then [b] once.
    const ai = scripted(broken, broken, broken, broken, ok);
    const parts = await askInParts(ai.provider, ['a', 'b'], request);
    expect(parts).toEqual([
      { part: ['a'], reply: null },
      { part: ['b'], reply: ok },
    ]);
  });

  it('stops at once on a refusal, without splitting', async () => {
    const ai = scripted({ ok: false, failure: 'no_quota' });
    const parts = await askInParts(ai.provider, ['a', 'b'], request);
    expect(parts).toEqual([{ part: ['a', 'b'], reply: { ok: false, failure: 'no_quota' } }]);
    expect(ai.asked()).toBe(1);
  });
});
