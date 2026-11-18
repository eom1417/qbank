import { expect, it } from 'vitest';
import { asDetectionIssues } from '../../../src/server/capabilities/sources/use-cases/detection-output.js';
import {
  detectionIssues,
  keepBlocks,
} from '../../../src/server/capabilities/sources/use-cases/pipeline-report.js';
import type { Detection } from '../../../src/server/capabilities/sources/detection/contract.js';
import type { SourcesDeps } from '../../../src/server/capabilities/sources/use-cases/deps.js';

it('preserves source line locations and unowned defects through the stored report', async () => {
  const source = {
    file: { lines: [{ page: 3 }, { page: 4 }] },
    questions: [{ number: 7 }],
    doubts: [
      { check: 'stem', question: 0, lines: [0], detail: 'Missing stem words' },
      { check: 'coverage', question: null, lines: [1], detail: 'Unowned source line' },
    ],
  } as unknown as Detection;
  const issues = asDetectionIssues(source);
  expect(issues.map((issue) => [issue.question, issue.pages, issue.lines])).toEqual([
    [7, [3], [1]],
    [null, [4], [2]],
  ]);
  const deps = {
    clock: { now: () => new Date('2026-11-18T10:00:00Z') },
    blocks: { replace: async () => {} },
  } as unknown as SourcesDeps;
  const facts = await keepBlocks(
    deps,
    { id: 'job', owner_id: 'owner' },
    { blocks: [], family: null, issues },
  );
  expect(detectionIssues({ pipeline_facts: JSON.parse(facts) })).toEqual(issues);
});

it('reads older reports without capture issues as an empty list', () => {
  expect(detectionIssues({ pipeline_facts: { family: null, unknownPages: [] } })).toEqual([]);
});
