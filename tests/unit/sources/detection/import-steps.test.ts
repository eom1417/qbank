import { describe, expect, it } from 'vitest';
import type { StepReport } from '../../../../src/server/capabilities/sources/detection/contract.js';
import type { SourcesDeps } from '../../../../src/server/capabilities/sources/use-cases/deps.js';
import { stepRecorder } from '../../../../src/server/capabilities/sources/use-cases/import-steps.js';

const report = (step: StepReport['step'], done: number): StepReport => ({
  step,
  status: 'running',
  done,
  total: 10,
  note: null,
});

describe('stepRecorder', () => {
  it('keeps one entry per step, in step order, and saves them on the job', async () => {
    const saved: { id: string; steps: StepReport[] }[] = [];
    const deps = {
      imports: {
        update: async (id: string, changes: { steps: string }) => {
          saved.push({ id, steps: JSON.parse(changes.steps) as StepReport[] });
        },
      },
    } as unknown as SourcesDeps;
    const record = stepRecorder(deps, 'job-1');
    await record(report('roles', 1));
    await record(report('inspect', 2));
    await record(report('roles', 5));
    const last = saved[saved.length - 1];
    expect(last?.id).toBe('job-1');
    expect(last?.steps.map((s) => [s.step, s.done])).toEqual([
      ['inspect', 2],
      ['roles', 5],
    ]);
  });
});
