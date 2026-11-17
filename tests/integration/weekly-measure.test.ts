import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { StructuredRequest } from '../../src/server/capabilities/providers/index.js';
import { createMeasurementRepository } from '../../src/server/capabilities/sources/adapters/measurements.js';
import { referenceSet } from '../../src/server/capabilities/sources/domain/pipeline/reference-set.js';
import {
  measureDue,
  MEASURE_EVERY_MS,
  type MeasureDeps,
  type OperatorAi,
} from '../../src/server/capabilities/sources/use-cases/weekly-measure.js';
import { newId } from '../../src/server/platform/ids.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports, uploadFile } from '../support/imports.js';
import { signedInOperator } from '../support/operator.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P6 (Q15): the weekly measurement of the approved models on the built-in reference set,
// with a fake provider (in process) and through the app with the fake AI host.

const LIGHT = 'claude-haiku-5-5';
const STRONG = 'claude-opus-5-5';
let now = new Date('2026-11-17T10:00:00Z');
const clock = { now: () => now };
const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings, clock });
const pipelineFile = usePipelineFile();

/** What the reference set expects, per lesson, in cell order. */
const expected = () => {
  const set = referenceSet();
  return {
    lesson_D4_mark: set['D4.mark'].map((item) => item.expected),
    lesson_D1_2: set['D1.2'].map((item) => item.expected),
  } as Record<string, object[]>;
};

type Answer = (lesson: string, cells: object[]) => object[];
const truthful: Answer = (_lesson, cells) => cells;

/** A provider that answers each sheet with `answer`, or fails every call with `failure`. */
function operatorAi(models: Record<string, Answer | 'no_quota'>, calls: string[] = []): OperatorAi {
  return {
    ownerId: 'operator',
    kind: 'claude',
    providerFor: (model) => ({
      generate<T>(request: StructuredRequest<T>) {
        calls.push(`${model} ${request.name}`);
        const answer = models[model];
        if (!answer || answer === 'no_quota')
          return Promise.resolve({ ok: false as const, failure: 'no_quota' as const });
        const cells = answer(request.name, expected()[request.name] ?? []);
        const value = request.schema.parse({ items: cells.map((c, i) => ({ n: i + 1, ...c })) });
        return Promise.resolve({ ok: true as const, value, usage: null });
      },
    }),
  };
}

function world(ai: OperatorAi | null) {
  const alerts: string[] = [];
  const measurements = createMeasurementRepository(app.db(), newId);
  const deps: MeasureDeps = {
    measurements,
    operatorAi: () => Promise.resolve(ai),
    alert: async (message) => void alerts.push(message),
    now: () => now,
  };
  return { deps, alerts, measurements };
}

beforeEach(async () => {
  now = new Date('2026-11-17T10:00:00Z');
  await app.db().deleteFrom('model_measurement').execute();
});
// The table belongs to no account: other suites must not inherit an unapproved model.
afterAll(async () => {
  await app.db().deleteFrom('model_measurement').execute();
});

describe('the weekly measurement (Q15)', () => {
  it('measures every approved model once a week and keeps the passing ones approved', async () => {
    const { deps, alerts, measurements } = world(
      operatorAi({ [LIGHT]: truthful, [STRONG]: truthful }),
    );
    expect(await measureDue(deps)).toBe('measured');
    const rows = await app.db().selectFrom('model_measurement').selectAll().execute();
    expect(rows.map((r) => `${r.lesson} ${r.model} ${r.correct}/${r.total}`).sort()).toEqual([
      `D1.2 ${LIGHT} 3/3`,
      `D1.2 ${STRONG} 3/3`,
      `D4.mark ${LIGHT} 6/6`,
      `D4.mark ${STRONG} 6/6`,
    ]);
    expect(alerts).toEqual([]);
    expect(await measurements.revoked()).toEqual(new Set());
    now = new Date(now.getTime() + MEASURE_EVERY_MS - 1);
    expect(await measureDue(deps)).toBe('not_due');
    now = new Date(now.getTime() + 1);
    expect(await measureDue(deps)).toBe('measured');
  });

  it('unapproves a model that drops, alerts the operator, and re-approves it when it passes', async () => {
    const blind: Answer = (lesson, cells) =>
      lesson === 'lesson_D4_mark' ? cells.map(() => ({ letter: null, eliminated: [] })) : cells;
    const calls: string[] = [];
    const failing = world(operatorAi({ [LIGHT]: blind, [STRONG]: truthful }, calls));
    expect(await measureDue(failing.deps)).toBe('measured');
    expect(await failing.measurements.revoked()).toEqual(new Set([`D4.mark\n${LIGHT}`]));
    expect(failing.alerts).toHaveLength(1);
    expect(failing.alerts[0]).toContain(`${LIGHT} missed 5 of 6 on lesson D4.mark`);
    // Measuring the light model never asked the strong one in its place.
    expect(calls.filter((c) => c.startsWith(STRONG)).length).toBe(2);
    const users = await app().inject({ method: 'GET', url: '/api/ai/approved-models' });
    expect(users.statusCode).toBe(401);

    now = new Date(now.getTime() + MEASURE_EVERY_MS);
    const passing = world(operatorAi({ [LIGHT]: truthful, [STRONG]: truthful }));
    expect(await measureDue(passing.deps)).toBe('measured');
    expect(await passing.measurements.revoked()).toEqual(new Set());
  });

  it('measures nothing without the operator’s AI or when the subscription is full', async () => {
    expect(await measureDue(world(null).deps)).toBe('no_ai');
    const full = world(operatorAi({ [LIGHT]: 'no_quota', [STRONG]: 'no_quota' }));
    expect(await measureDue(full.deps)).toBe('measured');
    expect(await app.db().selectFrom('model_measurement').selectAll().execute()).toEqual([]);
    expect(full.alerts).toEqual([]);
  });
});

describe('the weekly measurement in the app (Q15)', () => {
  it('asks the operator’s instance and alerts their inbox when a model drops', async () => {
    expect(await app().measurement.runDue()).toBe('no_ai');
    const { browser: operator } = await signedInOperator(app());
    await operator.post('/api/account/ai-consent', {});
    const bank = (await operator.post('/api/banks', { name: 'Ops' })).json();
    await uploadFile(app(), operator.cookie(), bank.id, pipelineFile(), {
      aiProviderId: FAKE_INSTANCES.lesson,
    });
    await runImports(app());
    // The fake host marks no option in any cell: the circled answers are missed.
    expect(await app().measurement.runDue()).toBe('measured');
    const notes = (await operator.get('/api/operator/feedback')).json();
    const alert = notes.items.find((n: { screen: string }) => n.screen === 'measurement');
    expect(alert.message).toContain('D4.mark');
    const tiers = (await operator.get('/api/ai/approved-models')).json();
    expect(tiers.kinds.claude.light).not.toContain(LIGHT);
    expect(tiers.kinds.codex).toEqual({ light: [], strong: [] });
  });
});
