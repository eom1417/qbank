import type { OnStep, StepId, StepReport } from '../detection/contract.js';
import type { SourcesDeps } from './deps.js';

/** The seven steps in the order the card lists them (M39 §5). */
export const STEP_ORDER: readonly StepId[] = [
  'inspect',
  'read',
  'roles',
  'link',
  'check',
  'assist',
  'save',
];

/** Keeps one report per step in step order, whatever order the steps report in. */
export function upsertStep(steps: readonly StepReport[], report: StepReport): StepReport[] {
  const rest = steps.filter((step) => step.step !== report.step);
  return [...rest, report].sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));
}

/** Saves each step's report on the job, so the import card follows detection live. */
export function stepRecorder(deps: SourcesDeps, jobId: string): OnStep {
  let steps: StepReport[] = [];
  return async (report) => {
    steps = upsertStep(steps, report);
    await deps.imports.update(jobId, { steps: JSON.stringify(steps) });
  };
}
