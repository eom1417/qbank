// M39 step 6: the AI's help on the doubts. Each doubt's region is asked of lesson D3.roles (text
// only: line ids and their words); the accepted roles replace the rules' roles for those lines.
// A lesson failure stops the step: what was done so far is returned with the failure.
import { createHash } from 'node:crypto';
import type { LessonUsage } from '../../../../../contracts/sources.js';
import type { AiFailure } from '../../../providers/index.js';
import { regionText, rolesLesson, type RolesInput } from '../../domain/pipeline/lessons/roles.js';
import { SHEET_LIMIT } from '../../domain/pipeline/sheet-layout.js';
import { sumUsage } from '../../use-cases/read-with-pipeline.js';
import {
  runLesson,
  type LessonDeps,
  type LessonItem,
  type LessonUsage as CallUsage,
} from '../../use-cases/run-lesson.js';
import type { Doubt, FileLines, LineRole } from '../contract.js';
import { acceptAnswer, type Accepted } from './accept.js';
import { regionOf } from './regions.js';

export interface Assisted {
  roles: LineRole[];
  corrections: Map<number, string>;
  usage: LessonUsage[];
  failure: AiFailure | null;
  resumeAfter: Date | null;
}

function itemOf(fileName: string, file: FileLines, region: number[]): LessonItem<RolesInput> {
  const shown = region.flatMap((id) => {
    const line = file.lines[id];
    return line ? [{ id, text: line.text, ocr: line.source !== 'text' }] : [];
  });
  const text = regionText(shown);
  const fingerprint = createHash('sha256').update(`${fileName}\n${text}`).digest('hex');
  return { input: { lines: region }, fingerprint, image: null, text };
}

/** The distinct regions of the doubts, in doubt order. */
function regionsOf(file: FileLines, roles: readonly LineRole[], doubts: readonly Doubt[]) {
  const seen = new Set<string>();
  return doubts
    .map((doubt) => regionOf(doubt, roles, file.lines.length))
    .filter((region) => {
      const key = region.join(',');
      const fresh = region.length > 0 && !seen.has(key);
      seen.add(key);
      return fresh;
    });
}

function merge(roles: readonly LineRole[], found: Accepted): LineRole[] {
  const byLine = new Map(found.roles.map((role) => [role.line, role]));
  return roles.map((role) => byLine.get(role.line) ?? role);
}

/**
 * Asks the lesson about every doubt's region, a sheet at a time, reporting progress after each.
 * Roles it gives replace the rules' roles (byModel); OCR spelling fixes become corrections.
 */
export async function assistDoubts(
  deps: LessonDeps,
  fileName: string,
  file: FileLines,
  roles: LineRole[],
  doubts: Doubt[],
  onProgress: (done: number, total: number) => Promise<void>,
): Promise<Assisted> {
  const regions = regionsOf(file, roles, doubts);
  const found: Accepted = { roles: [], corrections: new Map() };
  const calls: CallUsage[] = [];
  const result = (failure: AiFailure | null, resumeAfter: Date | null): Assisted => ({
    roles: merge(roles, found),
    corrections: found.corrections,
    usage: sumUsage(null, calls),
    failure,
    resumeAfter,
  });
  for (let at = 0; at < regions.length; at += SHEET_LIMIT) {
    const sheet = regions.slice(at, at + SHEET_LIMIT);
    const run = await runLesson(
      deps,
      rolesLesson,
      sheet.map((r) => itemOf(fileName, file, r)),
    );
    calls.push(...run.usage);
    run.results.forEach((done, index) => {
      if (done?.status !== 'answered') return;
      const accepted = acceptAnswer(file, sheet[index] ?? [], done.output);
      found.roles.push(...accepted.roles);
      accepted.corrections.forEach((text, id) => found.corrections.set(id, text));
    });
    if (run.failure) return result(run.failure, run.resumeAfter);
    await onProgress(Math.min(regions.length, at + SHEET_LIMIT), regions.length);
  }
  return result(null, null);
}
