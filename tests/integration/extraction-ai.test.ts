import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { providerFor } from '../../src/server/capabilities/ai/index.js';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';
import { extractQuestions, suggestMarks } from '../../src/server/capabilities/sources/index.js';
import { FAKE_KEYS, FAKE_MODELS, startFakeAiServer } from '../support/fake-ai-server.js';

// The AI layer over the rules, with the user's own provider (here a fake one, both protocols).
let fake: Awaited<ReturnType<typeof startFakeAiServer>>;
let dir = '';
let pdf = '';
beforeAll(async () => {
  fake = await startFakeAiServer();
  dir = mkdtempSync(join(tmpdir(), 'qbank-ai-'));
  pdf = join(dir, 'sample.pdf');
  await runTool('mutool', ['create', '-o', pdf, 'tests/fixtures/extraction/sample-page.txt']);
});
afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await fake.close();
});

const provider = (kind: 'openai_compatible' | 'anthropic', apiKey: string) =>
  providerFor(
    {
      kind,
      baseUrl: kind === 'anthropic' ? fake.anthropicUrl : fake.url,
      apiKey,
      model: FAKE_MODELS.vision,
    },
    true,
  );

describe.each(['openai_compatible', 'anthropic'] as const)('AI mark suggestions via %s', (kind) => {
  it('asks only about undecided questions, with the page image, and labels the answer', async () => {
    const rules = await extractQuestions(pdf, 'text');
    const before = fake.calls.length;
    const suggested = await suggestMarks(pdf, rules, provider(kind, FAKE_KEYS.valid));
    expect(suggested.map((q) => [q.number, q.answer, q.evidence])).toEqual([
      [1, 'C', 'pen_mark'],
      [2, 'A', 'single_option'],
      [3, 'A', 'ai_suggested'],
    ]);
    const asked = fake.calls.slice(before);
    expect(asked).toHaveLength(1);
    expect(JSON.stringify(asked[0]?.body)).toMatch(
      kind === 'anthropic' ? /"type":"image"/ : /"image_url"/,
    );
  });

  it('keeps the question undecided when the provider refuses', async () => {
    const rules = await extractQuestions(pdf, 'text');
    const suggested = await suggestMarks(pdf, rules, provider(kind, 'sk-wrong-key-999'));
    expect(suggested[2]).toMatchObject({ answer: null, evidence: null });
  });
});
