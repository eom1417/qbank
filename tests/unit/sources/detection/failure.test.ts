import { expect, it } from 'vitest';
import { detect } from '../../../../src/server/capabilities/sources/detection/detect.js';
import type { StepReport } from '../../../../src/server/capabilities/sources/detection/contract.js';

it('marks the running step failed when its reader throws', async () => {
  const reports: StepReport[] = [];
  await expect(
    detect('unreadable.pdf', {
      lessons: null,
      reader: {
        units: async () => {
          throw new Error('reader stopped');
        },
        pages: async () => [],
      },
      onStep: async (report) => {
        reports.push(report);
      },
    }),
  ).rejects.toThrow('reader stopped');
  expect(reports.at(-1)).toMatchObject({ step: 'read', status: 'failed', note: 'read_failed' });
});
