import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type {
  StructuredRequest,
  StructuredResult,
} from '../../../src/server/capabilities/providers/index.js';
import type { LessonCard } from '../../../src/server/capabilities/sources/domain/pipeline/lesson.js';
import type {
  CachedStep,
  NewStep,
} from '../../../src/server/capabilities/sources/adapters/step-cache.js';
import {
  runLesson,
  type LessonDeps,
  type LessonItem,
} from '../../../src/server/capabilities/sources/use-cases/run-lesson.js';

// M34 P3: the lesson engine on RECORDED replies only (a fake provider, an in-memory cache).

type Mark = { option: string; marked: boolean };
const card: LessonCard<{ options: string[] }, Mark> = {
  id: 'D4.mark',
  level: 4,
  needs: 'vision',
  version: 1,
  question: 'Is this option marked as the answer? yes/no',
  yesCues: ['a circle around the letter'],
  noCues: ['an ✗ next to the letter'],
  schema: z.object({ option: z.string(), marked: z.boolean() }),
  check: (input, out) =>
    input.options.includes(out.option) ? null : `${out.option} is not an option`,
  reviewReason: 'mark_unclear',
};
const LIGHT = 'claude-haiku-5-5';
const STRONG = 'claude-opus-5-5';
const NOW = new Date('2026-11-16T10:00:00Z');

const item = (index: number): LessonItem<{ options: string[] }> => ({
  input: { options: ['A', 'B'] },
  fingerprint: `crop-${index}`,
  image: { width: 20, height: 10, data: Buffer.alloc(600, 90) },
  text: null,
});
const items = (count: number) => Array.from({ length: count }, (_, i) => item(i));
const good = (count: number) => ({
  items: Array.from({ length: count }, (_, i) => ({ n: i + 1, option: 'A', marked: true })),
});
type Reply = StructuredResult<unknown>;
const ok = (value: unknown, usage = { inputTokens: 140, outputTokens: 30 }): Reply => ({
  ok: true,
  value,
  usage,
});

/** Replies recorded per model, served in order; every request is kept. */
function fakeWorld(recorded: Record<string, Reply[]>) {
  const calls: { model: string; request: StructuredRequest<unknown> }[] = [];
  const store = new Map<string, NewStep>();
  const deps: LessonDeps = {
    ownerId: 'owner-1',
    providerKind: 'claude',
    now: () => NOW,
    providerFor: (model) => ({
      generate: <T>(request: StructuredRequest<T>) => {
        calls.push({ model, request: request as StructuredRequest<unknown> });
        const reply = recorded[model]?.shift() ?? { ok: false, failure: 'unexpected' };
        if (!reply.ok) return Promise.resolve(reply);
        const parsed = request.schema.safeParse(reply.value);
        const result: StructuredResult<T> = parsed.success
          ? { ok: true, value: parsed.data, usage: reply.usage }
          : { ok: false, failure: 'invalid_output' };
        return Promise.resolve(result);
      },
    }),
    cache: {
      get: (_owner, key) => Promise.resolve<CachedStep | null>(store.get(key) ?? null),
      put: (step) => Promise.resolve(void store.set(step.key, step)),
    },
  };
  return { deps, calls, store };
}

/** The text sent in call `index`. */
const textOf = (calls: readonly { request: StructuredRequest<unknown> }[], index: number) =>
  (calls[index]?.request.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

describe('running a lesson (M34 P3)', () => {
  it('answers a sheet with one light call over one image, recording its usage', async () => {
    const world = fakeWorld({ [LIGHT]: [ok(good(3))] });
    const run = await runLesson(world.deps, card, items(3));
    expect(run.results).toEqual(
      items(3).map(() => ({
        status: 'answered',
        output: { option: 'A', marked: true },
        model: LIGHT,
      })),
    );
    expect(world.calls).toHaveLength(1);
    expect(world.calls[0]?.request.parts.map((part) => part.type)).toEqual(['image', 'text']);
    expect(run.usage).toEqual([
      { lesson: 'D4.mark', model: LIGHT, inputTokens: 140, outputTokens: 30, estimated: false },
    ]);
    expect(run).toMatchObject({ paused: false, resumeAfter: null, failure: null });
  });

  it('splits into sheets of ten and reuses the cache without a call', async () => {
    const world = fakeWorld({ [LIGHT]: [ok(good(10)), ok(good(2))] });
    await runLesson(world.deps, card, items(12), { concurrency: 1 });
    expect(world.calls).toHaveLength(2);
    const again = await runLesson(world.deps, card, items(12));
    expect(world.calls).toHaveLength(2);
    expect(again.usage).toEqual([]);
    expect(again.results.every((result) => result?.status === 'answered')).toBe(true);
  });

  it('retries only the failed items once, with their errors, then succeeds', async () => {
    const first = {
      items: [
        { n: 1, option: 'A', marked: true },
        { n: 2, option: 'Q', marked: true },
      ],
    };
    const second = { items: [{ n: 1, option: 'B', marked: false }] };
    const world = fakeWorld({ [LIGHT]: [ok(first), ok(second)] });
    const run = await runLesson(world.deps, card, items(2));
    expect(run.results[1]).toEqual({
      status: 'answered',
      output: { option: 'B', marked: false },
      model: LIGHT,
    });
    const retry = textOf(world.calls, 1);
    expect(retry).toContain('Cell 1: Q is not an option');
    expect(retry).toContain('Cells are numbered 1…1');
  });
});

describe('escalating a lesson (M34 P3)', () => {
  it('escalates to the strong model after a failed retry', async () => {
    const world = fakeWorld({
      [LIGHT]: [ok({ items: [] }), ok({ wrong: true })],
      [STRONG]: [ok(good(1))],
    });
    const run = await runLesson(world.deps, card, items(1));
    expect(world.calls.map((call) => call.model)).toEqual([LIGHT, LIGHT, STRONG]);
    expect(textOf(world.calls, 1)).toContain('Cell 1: no answer was given');
    expect(run.results[0]).toEqual({
      status: 'answered',
      output: { option: 'A', marked: true },
      model: STRONG,
    });
    expect(run.usage[1]).toMatchObject({ model: LIGHT, outputTokens: 0, estimated: true });
  });

  it('sends what never passes to review with the card reason', async () => {
    const twice = {
      items: [
        { n: 1, option: 'A', marked: true },
        { n: 1, option: 'B', marked: true },
      ],
    };
    const world = fakeWorld({ [LIGHT]: [ok(twice), ok(twice)], [STRONG]: [ok(twice)] });
    const run = await runLesson(world.deps, card, items(1));
    expect(textOf(world.calls, 1)).toContain('answered 2 times');
    expect(run.results).toEqual([{ status: 'review', reason: 'mark_unclear' }]);
  });

  it('goes straight to review when no model is approved (Codex, unmeasured)', async () => {
    const world = fakeWorld({});
    const run = await runLesson({ ...world.deps, providerKind: 'codex' }, card, items(2));
    expect(world.calls).toHaveLength(0);
    expect(run.results).toEqual([
      { status: 'review', reason: 'mark_unclear' },
      { status: 'review', reason: 'mark_unclear' },
    ]);
  });
});

describe('pausing and stopping a lesson (M34 P3)', () => {
  it('pauses on an empty quota, keeping finished sheets cached for the resume', async () => {
    const world = fakeWorld({ [LIGHT]: [ok(good(10)), { ok: false, failure: 'no_quota' }] });
    const run = await runLesson(world.deps, card, items(13), { concurrency: 1 });
    expect(run).toMatchObject({ paused: true, failure: 'no_quota' });
    expect(run.resumeAfter?.getTime()).toBeGreaterThan(NOW.getTime());
    expect(run.results.slice(0, 10).every((result) => result?.status === 'answered')).toBe(true);
    expect(run.results.slice(10)).toEqual([null, null, null]);
    expect(world.store.size).toBe(1);
    const resumed = fakeWorld({ [LIGHT]: [ok(good(3))] });
    const finished = await runLesson({ ...resumed.deps, cache: world.deps.cache }, card, items(13));
    expect(resumed.calls).toHaveLength(1);
    expect(finished.results.every((result) => result?.status === 'answered')).toBe(true);
  });

  it('stops, without review, on a failure a retry cannot fix', async () => {
    const world = fakeWorld({ [LIGHT]: [{ ok: false, failure: 'invalid_key' }] });
    const run = await runLesson(world.deps, card, items(2));
    expect(run).toMatchObject({ paused: false, resumeAfter: null, failure: 'invalid_key' });
    expect(run.results).toEqual([null, null]);
  });

  it('estimates tokens when the provider reports none, and asks text lessons without an image', async () => {
    const textCard = { ...card, id: 'D1.2', needs: 'text' as const };
    const world = fakeWorld({ [LIGHT]: [{ ok: true, value: good(2), usage: null }] });
    const texts = items(2).map((one, i) => ({ ...one, image: null, text: `line ${i}` }));
    const run = await runLesson(world.deps, textCard, texts);
    expect(world.calls[0]?.request.parts.map((part) => part.type)).toEqual(['text']);
    expect(textOf(world.calls, 0)).toContain('<<<item 2>>>\nline 1');
    expect(run.usage[0]).toMatchObject({ estimated: true });
    expect(run.usage[0]?.inputTokens).toBeGreaterThan(50);
  });
});
