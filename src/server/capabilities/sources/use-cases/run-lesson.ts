// M34 P3: runs one lesson over many items, a contact sheet of ≤ 10 at a time: the step cache
// first, then the light model, one retry with the errors, the strong model, and review.
import { mapWithLimit } from '../../../platform/concurrency.js';
import type { AiFailure, AiProvider, StructuredRequest } from '../../providers/index.js';
import { modelFor, type ModelTier, type ProviderKind } from '../domain/pipeline/approved-models.js';
import {
  judgeSheet,
  replySchema,
  type ItemVerdict,
  type LessonCard,
  type SheetReply,
} from '../domain/pipeline/lesson.js';
import { buildPrompt, PROMPT_VERSION } from '../domain/pipeline/prompt-standard.js';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';
import { SHEET_LIMIT, SHEET_LONG_EDGE } from '../domain/pipeline/sheet-layout.js';
import { composeSheet } from '../adapters/sheet-image.js';
import { stepKey, type StepCache } from '../adapters/step-cache.js';

/** One item: what `check` sees, its content fingerprint (K5), and its crop or its text. */
export interface LessonItem<I> {
  input: I;
  fingerprint: string;
  image: RgbImage | null;
  text: string | null;
}

export interface LessonUsage {
  lesson: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** True when the provider gave no usage and the tokens were estimated. */
  estimated: boolean;
}

export type ItemResult<O> =
  { status: 'answered'; output: O; model: string } | { status: 'review'; reason: string };

export interface LessonRun<O> {
  /** In input order; null = not finished (the run paused or stopped first). */
  results: (ItemResult<O> | null)[];
  usage: LessonUsage[];
  /** The subscription's limit was reached: resume after `resumeAfter`, from the step cache. */
  paused: boolean;
  resumeAfter: Date | null;
  /** Why the run paused (`no_quota`, `rate_limited`) or stopped (a refused key, …), or null. */
  failure: AiFailure | null;
}

export interface LessonDeps {
  ownerId: string;
  providerKind: ProviderKind;
  /** The user's provider bound to one model. */
  providerFor(model: string): AiProvider;
  cache: Pick<StepCache, 'get' | 'put'>;
  now(): Date;
  /** The tier the lessons start with (Q14): `strong` skips the light model; light by default. */
  startTier?: ModelTier;
  /** False when the weekly measurement unapproved the model for the lesson (Q15). */
  approved?(lesson: string, model: string): boolean;
}

export interface LessonOptions {
  /** Sheets asked at once (the user's subscription allows a few). */
  concurrency?: number;
}

const PAUSE_MS: Partial<Record<AiFailure, number>> = {
  no_quota: 60 * 60_000,
  rate_limited: 2 * 60_000,
};
/** A failed call that counts as a wrong answer: it is retried and escalated like one. */
const ANSWER_FAILURES = new Set<AiFailure>(['invalid_output', 'unreachable']);
/** Image tokens per pixel, and characters per text token, when the provider reports no usage. */
const PIXELS_PER_TOKEN = 750;
const CHARS_PER_TOKEN = 4;

interface Stage {
  name: 'first' | 'retry' | 'strong';
  tier: ModelTier;
  corrected: boolean;
}

const STAGES: readonly Stage[] = [
  { name: 'first', tier: 'light', corrected: false },
  { name: 'retry', tier: 'light', corrected: true },
  { name: 'strong', tier: 'strong', corrected: false },
];

interface Run<I, O> {
  deps: LessonDeps;
  card: LessonCard<I, O>;
  usage: LessonUsage[];
  halt: { failure: AiFailure } | null;
}

type Attempt<O> = { reply: SheetReply<O> | null } | { halt: AiFailure };

interface SheetRequest<O> {
  request: StructuredRequest<SheetReply<O>>;
  pixels: number;
}

function requestFor<I, O>(
  card: LessonCard<I, O>,
  items: readonly LessonItem<I>[],
  tier: ModelTier,
  corrections: readonly string[],
): SheetRequest<O> {
  const vision = card.needs === 'vision' || items.some((item) => item.image !== null);
  const texts = card.needs === 'vision' ? null : items.map((item) => item.text ?? '');
  const prompt = buildPrompt(card, { count: items.length, texts }, corrections);
  const base = { name: `lesson_${card.id.replace(/\W/g, '_')}`, system: prompt.system };
  const schema = replySchema(card);
  const textPart = { type: 'text' as const, text: prompt.text };
  if (!vision) return { request: { ...base, schema, parts: [textPart] }, pixels: 0 };
  const images = items.map((item) => {
    if (!item.image && card.needs === 'text')
      return { width: 1, height: 1, data: Buffer.alloc(3, 255) };
    if (!item.image) throw new Error(`lesson ${card.id} needs a picture for every item`);
    return item.image;
  });
  const sheet = composeSheet(images, SHEET_LONG_EDGE[tier]);
  const image = { type: 'image' as const, mediaType: 'image/png' as const };
  const parts = [{ ...image, base64: sheet.png.toString('base64') }, textPart];
  return { request: { ...base, schema, parts }, pixels: sheet.width * sheet.height };
}

/** Input as Σ(w·h/750) + text length/4; output as the reply's JSON length/4. */
function estimate<O>(sheet: SheetRequest<O>, reply: SheetReply<O> | null) {
  const text = sheet.request.parts.reduce(
    (sum, part) => sum + (part.type === 'text' ? part.text.length : 0),
    sheet.request.system.length,
  );
  const output = reply === null ? 0 : JSON.stringify(reply).length;
  return {
    inputTokens: Math.ceil(sheet.pixels / PIXELS_PER_TOKEN + text / CHARS_PER_TOKEN),
    outputTokens: Math.ceil(output / CHARS_PER_TOKEN),
  };
}

async function fromCache<I, O>(run: Run<I, O>, key: string): Promise<SheetReply<O> | null> {
  const cached = await run.deps.cache.get(run.deps.ownerId, key, run.deps.now());
  if (!cached) return null;
  const parsed = replySchema(run.card).safeParse(cached.reply);
  return parsed.success ? parsed.data : null;
}

/** One question for one sheet: the cache, else the model (its usage recorded, its reply cached). */
async function ask<I, O>(
  run: Run<I, O>,
  items: readonly LessonItem<I>[],
  model: string,
  stage: Stage,
  corrections: readonly string[],
): Promise<Attempt<O>> {
  const { deps, card } = run;
  const key = stepKey({
    ownerId: deps.ownerId,
    lesson: card.id,
    lessonVersion: card.version,
    promptVersion: PROMPT_VERSION,
    model,
    stage: [stage.name, ...corrections].join('\n'),
    fingerprints: items.map((item) => item.fingerprint),
  });
  const cached = await fromCache(run, key);
  if (cached) return { reply: cached };
  const sheet = requestFor(card, items, stage.tier, corrections);
  const result = await deps.providerFor(model).generate(sheet.request);
  if (!result.ok && !ANSWER_FAILURES.has(result.failure)) return { halt: result.failure };
  const reply = result.ok ? result.value : null;
  const tokens = (result.ok ? result.usage : null) ?? estimate(sheet, reply);
  const estimated = !result.ok || result.usage === null;
  run.usage.push({ lesson: card.id, model, ...tokens, estimated });
  if (reply)
    await deps.cache.put({ key, ownerId: deps.ownerId, lesson: card.id, model, reply, ...tokens });
  return { reply };
}

interface SheetState<O> {
  results: (ItemResult<O> | null)[];
  /** Indices (within the sheet) still without a passing answer. */
  pending: number[];
  /** The last errors of the pending items, in `pending` order. */
  errors: string[];
}

function applyVerdicts<O>(state: SheetState<O>, verdicts: ItemVerdict<O>[], model: string) {
  const pending: number[] = [];
  const errors: string[] = [];
  verdicts.forEach((verdict, cell) => {
    const index = state.pending[cell] ?? -1;
    if (verdict.ok) state.results[index] = { status: 'answered', output: verdict.output, model };
    else {
      pending.push(index);
      errors.push(verdict.error);
    }
  });
  state.pending = pending;
  state.errors = errors;
}

/** Runs one stage on the sheet's pending items; false when the run must stop. */
async function runStage<I, O>(
  run: Run<I, O>,
  items: readonly LessonItem<I>[],
  state: SheetState<O>,
  stage: Stage,
): Promise<boolean> {
  const model = modelFor(run.card.id, run.deps.providerKind, stage.tier);
  if (model === null) return false;
  const asked = state.pending.flatMap((index) => (items[index] ? [items[index]] : []));
  const corrections = stage.corrected
    ? state.errors.map((error, cell) => `Cell ${cell + 1}: ${error}`)
    : [];
  const attempt = await ask(run, asked, model, stage, corrections);
  if ('halt' in attempt) {
    run.halt = { failure: attempt.halt };
    return false;
  }
  const inputs = asked.map((item) => item.input);
  applyVerdicts(state, judgeSheet(run.card, inputs, attempt.reply), model);
  return true;
}

/**
 * The stages a run asks: from its starting tier (Q14), without a model the weekly measurement
 * unapproved (Q15); an unapproved light model escalates straight to the strong one.
 */
function stagesOf<I, O>(run: Run<I, O>): readonly Stage[] {
  const { deps, card } = run;
  return STAGES.filter((stage) => {
    if (deps.startTier === 'strong' && stage.tier === 'light') return false;
    const model = modelFor(card.id, deps.providerKind, stage.tier);
    return model === null || deps.approved?.(card.id, model) !== false;
  });
}

async function runSheet<I, O>(
  run: Run<I, O>,
  items: readonly LessonItem<I>[],
): Promise<(ItemResult<O> | null)[]> {
  const state: SheetState<O> = {
    results: items.map(() => null),
    pending: items.map((_, index) => index),
    errors: [],
  };
  for (const stage of stagesOf(run)) {
    if (state.pending.length === 0 || run.halt) break;
    if (!(await runStage(run, items, state, stage))) break;
  }
  if (run.halt) return state.results;
  const review = { status: 'review' as const, reason: run.card.reviewReason };
  for (const index of state.pending) state.results[index] = review;
  return state.results;
}

function sheetsOf<T>(items: readonly T[]): T[][] {
  const sheets: T[][] = [];
  for (let at = 0; at < items.length; at += SHEET_LIMIT) {
    sheets.push(items.slice(at, at + SHEET_LIMIT));
  }
  return sheets;
}

/**
 * Asks one lesson about every item. Answers that fail the card's check (or the numbering rule)
 * are asked once more with their errors, then of the strong model, then go to review with the
 * card's reason. A full subscription pauses the run; what was finished stays cached.
 */
export async function runLesson<I, O>(
  deps: LessonDeps,
  card: LessonCard<I, O>,
  items: readonly LessonItem<I>[],
  options: LessonOptions = {},
): Promise<LessonRun<O>> {
  const run: Run<I, O> = { deps, card, usage: [], halt: null };
  const sheets = sheetsOf(items);
  const done = await mapWithLimit(sheets, options.concurrency ?? 2, (sheet) =>
    run.halt ? Promise.resolve(sheet.map(() => null)) : runSheet(run, sheet),
  );
  const failure = run.halt?.failure ?? null;
  const pauseMs = failure === null ? undefined : PAUSE_MS[failure];
  return {
    results: done.flat(),
    usage: run.usage,
    paused: pauseMs !== undefined,
    resumeAfter: pauseMs === undefined ? null : new Date(deps.now().getTime() + pauseMs),
    failure,
  };
}
