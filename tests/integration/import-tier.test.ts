import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports, uploadFile } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P6 (Q14): light (faster, cheaper) or strong (most careful), among the approved models of
// the user's provider kind; the job keeps its tier and its lessons start there. A model the
// weekly measurement unapproved (Q15) is never asked.

const LIGHT = 'claude-haiku-5-5';
const STRONG = 'claude-opus-5-5';
const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings, importRequiresAi: true });
const pipelineFile = usePipelineFile();

/** The models the lesson sheets were asked of, from this point on. */
function lessonModels() {
  const from = fake().asks.length;
  return () => [
    ...new Set(
      fake()
        .asks.slice(from)
        .filter((ask) => /The image has \d+ cells/.test(ask.body.prompt ?? ''))
        .map((ask) => ask.body.model),
    ),
  ];
}

async function importWith(fields: Record<string, string>) {
  const { owner, bankId } = await ownerWithBank(app());
  await owner.post('/api/account/ai-consent', {});
  const asked = lessonModels();
  const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
    aiProviderId: FAKE_INSTANCES.lesson,
    ...fields,
  });
  if (started.statusCode !== 201) return { started, report: null, asked };
  await runImports(app());
  const report = (await owner.get(`/api/imports/${started.json().id}`)).json();
  return { started, report, asked };
}

beforeEach(async () => {
  await app.db().deleteFrom('model_measurement').execute();
});

afterEach(async () => {
  await app.db().deleteFrom('model_measurement').execute();
});

describe('the light / strong choice (Q14)', () => {
  it('starts with the light model by default', async () => {
    const { report, asked } = await importWith({});
    expect(report.ai.tier).toBe('light');
    expect(asked()[0]).toBe(LIGHT);
  });

  it('asks only the strong model when the owner chose strong', async () => {
    const { report, asked } = await importWith({ aiTier: 'strong' });
    expect(report.ai.tier).toBe('strong');
    expect(asked()).toEqual([STRONG]);
  });

  it('refuses an unknown tier, and an older mode on a server (Q7)', async () => {
    const { started } = await importWith({ aiTier: 'medium' });
    expect(started.statusCode).toBe(400);
    const verify = await importWith({ aiMode: 'verify' });
    expect(verify.started.json().error.code).toBe('ai_required');
  });

  it('never asks a model the weekly measurement unapproved', async () => {
    await app
      .db()
      .insertInto('model_measurement')
      .values({
        id: '00000000-0000-4000-8000-000000000001',
        lesson: 'D4.mark',
        provider_kind: 'claude',
        model: LIGHT,
        correct: 1,
        total: 6,
        passed: false,
        ran_at: new Date(),
      })
      .execute();
    const { asked } = await importWith({});
    expect(asked()).toEqual([STRONG]);
  });
});

describe('the approved models the form may offer (Q14)', () => {
  it('lists the light and strong models per provider kind, to signed-in users only', async () => {
    const { owner } = await ownerWithBank(app());
    const tiers = (await owner.get('/api/ai/approved-models')).json();
    expect(tiers.kinds.claude).toEqual({ light: [LIGHT], strong: [STRONG] });
    expect(tiers.kinds.codex).toEqual({ light: [], strong: [] });
    const anonymous = await app().inject({ method: 'GET', url: '/api/ai/approved-models' });
    expect(anonymous.statusCode).toBe(401);
  });
});
