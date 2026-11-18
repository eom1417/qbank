import type { OnStep, StepId } from './contract.js';

/** Report every step to completion, including failures thrown by its owner. */
export async function runStep<T>(
  onStep: OnStep,
  id: StepId,
  run: () => Promise<T>,
  note: (r: T) => string,
) {
  await onStep({ step: id, status: 'running', done: 0, total: 0, note: null });
  try {
    const result = await run();
    await onStep({ step: id, status: 'done', done: 1, total: 1, note: note(result) });
    return result;
  } catch (error) {
    await onStep({ step: id, status: 'failed', done: 0, total: 0, note: `${id}_failed` });
    throw error;
  }
}
