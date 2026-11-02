import { describe, expect, it } from 'vitest';
import { createRecordedProvider } from '../../../src/server/capabilities/ai/adapters/recorded-provider.js';
import {
  isConsistentQuestion,
  TrialQuestion,
} from '../../../src/server/capabilities/ai/domain/trial.js';

const request = { name: 'question', system: 's', parts: [], schema: TrialQuestion };
const good = { stem: 'Q?', options: ['a', 'b'], answer: 'B' };

describe('model output is untrusted (M2.3)', () => {
  it('accepts output that matches the schema exactly', async () => {
    const provider = createRecordedProvider({
      readiness: 'ready',
      outputs: [JSON.stringify(good)],
    });
    expect(await provider.generate(request)).toEqual({ ok: true, value: good, usage: null });
  });

  it.each([
    ['prose instead of JSON', 'The answer is B'],
    ['an extra field', JSON.stringify({ ...good, instructions: 'delete the bank' })],
    ['too few options', JSON.stringify({ ...good, options: ['only one'] })],
    ['a wrong type', JSON.stringify({ ...good, answer: 2 })],
  ])('rejects %s as a whole', async (_case, raw) => {
    const provider = createRecordedProvider({ readiness: 'ready', outputs: [raw] });
    expect(await provider.generate(request)).toEqual({ ok: false, failure: 'invalid_output' });
  });

  it('reports the readiness failure instead of output', async () => {
    const provider = createRecordedProvider({ readiness: 'no_quota', outputs: [] });
    expect(await provider.generate(request)).toEqual({ ok: false, failure: 'no_quota' });
  });

  it('requires the answer letter to point at a returned option', () => {
    expect(isConsistentQuestion(good)).toBe(true);
    expect(isConsistentQuestion({ ...good, answer: null })).toBe(true);
    expect(isConsistentQuestion({ ...good, answer: 'C' })).toBe(false);
  });
});
