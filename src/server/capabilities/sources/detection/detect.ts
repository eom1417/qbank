import type { LessonUsage } from '../../../../contracts/sources.js';
import type { AiFailure } from '../../providers/index.js';
import type { LessonDeps } from '../use-cases/run-lesson.js';
import { assistDoubts } from './assist/assist-doubts.js';
import { runChecks } from './checks/run-checks.js';
import type {
  Detection,
  DetectedQuestion,
  FileLines,
  LineRole,
  OnStep,
  StepId,
} from './contract.js';
import { linkQuestions } from './link/link-questions.js';
import { toDetectedQuestions } from './link/to-detected.js';
import { readLines, type LinesReader } from './lines/read-lines.js';
import { classifyLines } from './roles/classify-lines.js';

// M39: the one detection path (plan §3). Seven steps, each reported to the import card; the
// rules draft, the generic checks decide, the AI helps only where a check failed, review last.

export interface DetectOptions {
  /** The user's AI for doubts (the "improve capture with AI" choice); null: rules and review. */
  lessons: LessonDeps | null;
  onStep?: OnStep;
  /** The bench may pass cached lines; the import reads the file. */
  reader?: LinesReader;
}

export interface DetectResult {
  detection: Detection;
  questions: DetectedQuestion[];
  usage: LessonUsage[];
  /** The AI stopped (a full subscription pauses, anything else is reported): rules kept. */
  stopped: { failure: AiFailure; resumeAfter: Date | null } | null;
}

const noStep: OnStep = () => Promise.resolve();

async function step<T>(onStep: OnStep, id: StepId, run: () => Promise<T>, note: (r: T) => string) {
  await onStep({ step: id, status: 'running', done: 0, total: 0, note: null });
  const result = await run();
  await onStep({ step: id, status: 'done', done: 1, total: 1, note: note(result) });
  return result;
}

/** Steps 3–5 over the lines: roles, questions, doubts; each reported on its own. */
async function draft(fileName: string, file: FileLines, onStep: OnStep, given?: LineRole[]) {
  const roles = await step(
    onStep,
    'roles',
    async () => given ?? classifyLines(file),
    (r) => `${r.filter((one) => one.role === 'label').length} numbered`,
  );
  const questions = await step(
    onStep,
    'link',
    () => linkQuestions(fileName, file, roles),
    (q) => `${q.length} questions`,
  );
  const doubts = await step(
    onStep,
    'check',
    async () => runChecks(file, roles, questions),
    (d) => `${d.length} doubts`,
  );
  return { roles, questions, doubts };
}

export async function detect(fileName: string, options: DetectOptions): Promise<DetectResult> {
  const onStep = options.onStep ?? noStep;
  await onStep({ step: 'inspect', status: 'done', done: 1, total: 1, note: null });
  const file = await step(
    onStep,
    'read',
    () => readLines(fileName, options.reader),
    (read) => `${read.pages.length} pages, ${read.lines.length} lines`,
  );
  const first = await draft(fileName, file, onStep);
  let current = first;
  let usage: LessonUsage[] = [];
  let stopped: DetectResult['stopped'] = null;
  let corrections = new Map<number, string>();
  if (options.lessons && first.doubts.length > 0) {
    const report = (done: number, total: number) =>
      onStep({ step: 'assist', status: 'running', done, total, note: null });
    const helped = await assistDoubts(
      options.lessons,
      fileName,
      file,
      first.roles,
      first.doubts,
      report,
    );
    usage = helped.usage;
    corrections = helped.corrections;
    stopped = helped.failure ? { failure: helped.failure, resumeAfter: helped.resumeAfter } : null;
    current = await draft(fileName, file, noStep, helped.roles);
    await onStep({
      step: 'assist',
      status: helped.failure ? 'failed' : 'done',
      done: first.doubts.length - current.doubts.length,
      total: first.doubts.length,
      note: helped.failure,
    });
  } else {
    const why = options.lessons ? 'nothing to help with' : 'AI off';
    await onStep({ step: 'assist', status: 'skipped', done: 0, total: 0, note: why });
  }
  const detection: Detection = { file, ...current, corrections };
  return { detection, questions: toDetectedQuestions(detection), usage, stopped };
}
