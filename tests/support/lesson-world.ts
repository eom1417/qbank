import type {
  StructuredRequest,
  StructuredResult,
} from '../../src/server/capabilities/providers/index.js';
import type {
  CachedStep,
  NewStep,
} from '../../src/server/capabilities/sources/adapters/step-cache.js';
import type { PipelineQuestion } from '../../src/server/capabilities/sources/domain/pipeline/question.js';
import type { LessonDeps } from '../../src/server/capabilities/sources/use-cases/run-lesson.js';

// M34 P4b: a lesson's world on RECORDED replies only: a fake provider per model that serves its
// replies in order (validated by the request's own schema) and an in-memory step cache.

export const LIGHT = 'claude-haiku-5-5';
export const STRONG = 'claude-opus-5-5';
export const NOW = new Date('2026-11-17T10:00:00Z');

export type Recorded = StructuredResult<unknown>;

export const recorded = (value: unknown): Recorded => ({
  ok: true,
  value,
  usage: { inputTokens: 1200, outputTokens: 40 },
});

/** The next recorded reply of `model`, checked against the request's schema as a provider would. */
function serve<T>(
  queue: Recorded[] | undefined,
  request: StructuredRequest<T>,
): StructuredResult<T> {
  const next = queue?.shift();
  if (!next) return { ok: false, failure: 'unexpected' };
  if (!next.ok) return next;
  const parsed = request.schema.safeParse(next.value);
  if (!parsed.success) return { ok: false, failure: 'invalid_output' };
  return { ok: true, value: parsed.data, usage: next.usage };
}

export function lessonWorld(replies: Record<string, Recorded[]>) {
  const calls: { model: string; request: StructuredRequest<unknown> }[] = [];
  const steps = new Map<string, NewStep>();
  const deps: LessonDeps = {
    ownerId: 'owner-1',
    providerKind: 'claude',
    now: () => NOW,
    providerFor(model) {
      const generate = <T>(request: StructuredRequest<T>) => {
        calls.push({ model, request: request as StructuredRequest<unknown> });
        return Promise.resolve(serve(replies[model], request));
      };
      return { generate };
    },
    cache: {
      get: (_owner, key) => Promise.resolve<CachedStep | null>(steps.get(key) ?? null),
      put: async (step) => void steps.set(step.key, step),
    },
  };
  return { deps, calls };
}

/** The text of call `index`. */
export const textOf = (calls: readonly { request: StructuredRequest<unknown> }[], index: number) =>
  (calls[index]?.request.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

/** A small grey crop: enough for a contact sheet. */
export const crop = (shade = 90) => ({ width: 20, height: 10, data: Buffer.alloc(600, shade) });

/** A synthetic question with these option letters; anything else as given. */
export function pipelineQuestion(
  letters: string,
  extra: Partial<PipelineQuestion> = {},
): PipelineQuestion {
  return {
    key: '1-1-0',
    number: 1,
    page: 1,
    pages: [1],
    stem: 'Which synthetic option is right?',
    options: [...letters].map((letter) => ({
      letter,
      label: letter,
      text: `option ${letter}`,
      spot: null,
    })),
    area: [{ page: 1, box: { x0: 10, y0: 10, x1: 300, y1: 120 } }],
    explanation: null,
    pictures: [],
    answers: [],
    evidence: [],
    conflicts: [],
    fromPicture: false,
    caseText: null,
    tags: { exam: null, year: null },
    reviewReasons: [],
    ...extra,
  };
}
