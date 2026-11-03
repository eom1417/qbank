import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAiHostClient } from '../../src/server/platform/ai-host/client.js';
import { kitProvider } from '../../src/server/capabilities/providers/index.js';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';
import { extractQuestions, suggestMarks } from '../../src/server/capabilities/sources/index.js';
import { FAKE_INSTANCES, startFakeAiHost } from '../support/fake-ai-host.js';

// The AI layer over the rules, through the user's provider instance in the kit (a fake host).
let fake: Awaited<ReturnType<typeof startFakeAiHost>>;
let dir = '';
let pdf = '';
beforeAll(async () => {
  fake = await startFakeAiHost();
  dir = mkdtempSync(join(tmpdir(), 'qbank-ai-'));
  pdf = join(dir, 'sample.pdf');
  await runTool('mutool', ['create', '-o', pdf, 'tests/fixtures/extraction/sample-page.txt']);
});
afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await fake.close();
});

const provider = (instanceId: string) =>
  kitProvider(createAiHostClient(fake.settings), 'account:test', instanceId);

describe('AI mark suggestions through the providers kit', () => {
  it('asks only about undecided questions, with the page image, and labels the answer', async () => {
    const rules = await extractQuestions(pdf, 'text');
    const before = fake.asks.length;
    const suggested = await suggestMarks(pdf, rules, provider(FAKE_INSTANCES.vision));
    expect(suggested.map((q) => [q.number, q.answer, q.evidence])).toEqual([
      [1, 'C', 'pen_mark'],
      [2, 'A', 'single_option'],
      [3, 'A', 'ai_suggested'],
    ]);
    const asked = fake.asks.slice(before);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.body.imagePngBase64?.length).toBeGreaterThan(100);
    expect(asked[0]?.body.prompt).toContain('JSON Schema');
  });

  it('keeps the question undecided when the provider refuses', async () => {
    const rules = await extractQuestions(pdf, 'text');
    const suggested = await suggestMarks(pdf, rules, provider(FAKE_INSTANCES.refusing));
    expect(suggested[2]).toMatchObject({ answer: null, evidence: null });
  });

  it('reports the host as unavailable when it has no token', async () => {
    const offline = kitProvider(
      createAiHostClient({ url: fake.settings.url, token: null }),
      'account:test',
      FAKE_INSTANCES.vision,
    );
    const request = { name: 'probe', system: 's', parts: [], schema: z.object({}) };
    await expect(offline.generate(request)).rejects.toMatchObject({ code: 'ai_host_unavailable' });
  });
});
