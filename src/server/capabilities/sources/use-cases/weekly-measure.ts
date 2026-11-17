// M34 P6 (Q15): once a week the server asks every approved model of each lesson the built-in
// reference set with the operator's own AI. A model that misses any item is unapproved for that
// lesson (until a later week passes) and the operator is alerted.
import type { AiProvider } from '../../providers/index.js';
import type { MeasurementRepository, Measurement } from '../adapters/measurements.js';
import { modelFor, type ModelTier, type ProviderKind } from '../domain/pipeline/approved-models.js';
import type { LessonCard } from '../domain/pipeline/lesson.js';
import { imageKindLesson } from '../domain/pipeline/lessons/image-kind.js';
import { markLesson } from '../domain/pipeline/lessons/mark.js';
import {
  kindMatches,
  markMatches,
  referenceSet,
  type ReferenceItem,
} from '../domain/pipeline/reference-set.js';
import type { ImportAi } from '../../providers/index.js';
import { openLessons } from './read-with-pipeline.js';
import { runLesson, type LessonDeps } from './run-lesson.js';

/** How often the models are measured. */
export const MEASURE_EVERY_MS = 7 * 24 * 60 * 60_000;

export interface OperatorAi {
  ownerId: string;
  kind: ProviderKind;
  /** The operator's instance bound to one model. */
  providerFor(model: string): AiProvider;
}

export interface MeasureDeps {
  measurements: MeasurementRepository;
  /** The operator's AI when one is configured and ready; null otherwise (nothing is measured). */
  operatorAi(): Promise<OperatorAi | null>;
  /** Tells the operator (their feedback inbox). */
  alert(message: string): Promise<void>;
  now(): Date;
}

/** A measurement never reads or writes the step cache: every week asks afresh. */
const NO_CACHE: LessonDeps['cache'] = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
};

interface Probe<I, O> {
  card: LessonCard<I, O>;
  items: ReferenceItem<I, O>[];
  matches(item: ReferenceItem<I, O>, output: O): boolean;
}

/** The model asked, at its tier, and the measurement's time. */
type Target = { model: string; tier: ModelTier; now: Date };

/** One lesson asked of one model only: escalating to another model ends the run unanswered. */
async function measureOne<I, O>(
  ai: OperatorAi,
  probe: Probe<I, O>,
  target: Target,
): Promise<Pick<Measurement, 'correct' | 'total'> | null> {
  const elsewhere = { escalated: false };
  const refuse: AiProvider = {
    generate: () => {
      elsewhere.escalated = true;
      return Promise.resolve({ ok: false, failure: 'model_missing' });
    },
  };
  const deps: LessonDeps = {
    ownerId: ai.ownerId,
    providerKind: ai.kind,
    providerFor: (model) => (model === target.model ? ai.providerFor(model) : refuse),
    cache: NO_CACHE,
    now: () => target.now,
    startTier: target.tier,
  };
  const items = probe.items.map((item) => ({ ...item, text: null }));
  const run = await runLesson(deps, probe.card, items);
  // The model itself stopped (a full subscription, a refused key): nothing was measured.
  if (run.failure && !elsewhere.escalated) return null;
  const correct = run.results.filter((result, index) => {
    const item = probe.items[index];
    return (
      result?.status === 'answered' && item !== undefined && probe.matches(item, result.output)
    );
  }).length;
  return { correct, total: probe.items.length };
}

/** A lesson's reference items, ready to be asked of one model. */
interface LessonProbe {
  lesson: string;
  measure(ai: OperatorAi, target: Target): ReturnType<typeof measureOne>;
}

const probeOf = <I, O>(
  card: LessonCard<I, O>,
  items: ReferenceItem<I, O>[],
  matches: Probe<I, O>['matches'],
): LessonProbe => ({
  lesson: card.id,
  measure: (ai, target) => measureOne(ai, { card, items, matches }, target),
});

function probes(): LessonProbe[] {
  const set = referenceSet();
  return [
    probeOf(markLesson, set['D4.mark'], markMatches),
    probeOf(imageKindLesson, set['D1.2'], kindMatches),
  ];
}

const TIERS: readonly ModelTier[] = ['light', 'strong'];

/** Every approved model of every lesson for the operator's provider kind, measured once. */
export async function measureModels(deps: MeasureDeps, ai: OperatorAi): Promise<Measurement[]> {
  const done: Measurement[] = [];
  const now = deps.now();
  for (const probe of probes()) {
    for (const tier of TIERS) {
      const model = modelFor(probe.lesson, ai.kind, tier);
      if (!model || done.some((m) => m.lesson === probe.lesson && m.model === model)) continue;
      const score = await probe.measure(ai, { model, tier, now });
      if (!score) continue;
      const measurement = {
        lesson: probe.lesson,
        providerKind: ai.kind,
        model,
        ...score,
        passed: score.correct === score.total,
        ranAt: now,
      };
      await deps.measurements.record(measurement);
      done.push(measurement);
    }
  }
  return done;
}

const alertText = (failed: readonly Measurement[]) =>
  'Weekly model measurement (Q15): ' +
  failed
    .map((m) => `${m.model} missed ${m.total - m.correct} of ${m.total} on lesson ${m.lesson}`)
    .join('; ') +
  '. Unapproved for those lessons until a later measurement passes.';

/**
 * Measures when a week has passed since the last measurement (main.ts checks hourly). Returns
 * what happened; a failing model is unapproved by its record and the operator is alerted.
 */
export async function measureDue(deps: MeasureDeps): Promise<'not_due' | 'no_ai' | 'measured'> {
  const last = await deps.measurements.lastRun();
  if (last && deps.now().getTime() - last.getTime() < MEASURE_EVERY_MS) return 'not_due';
  const ai = await deps.operatorAi();
  if (!ai) return 'no_ai';
  const failed = (await measureModels(deps, ai)).filter((m) => !m.passed);
  if (failed.length > 0) await deps.alert(alertText(failed));
  return 'measured';
}

/**
 * The operator's AI for the measurement: the instance their newest pipeline import ran on, of
 * the provider kind whose approved models it offers; null when there is none (Q15).
 */
export async function operatorAiOf(
  deps: { ai: ImportAi; measurements: MeasurementRepository; now(): Date },
  operatorId: string | null,
): Promise<OperatorAi | null> {
  if (!operatorId) return null;
  const instanceId = await deps.measurements.instanceOf(operatorId);
  if (!instanceId) return null;
  const owner = { ownerId: operatorId, instanceId, model: null };
  const lessons = await openLessons(deps.ai, owner, { cache: NO_CACHE, now: deps.now });
  return lessons
    ? { ownerId: operatorId, kind: lessons.providerKind, providerFor: lessons.providerFor }
    : null;
}
