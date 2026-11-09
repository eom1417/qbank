import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The owner's spec defines exactly these counts; a missing or duplicated row is a plan gap.
const EXPECTED = { FR: 225, UI: 28, JY: 19, UAT: 86 } as const;
// 24 from the owner's spec plus the additional ones raised while building (DEC-25…DEC-39).
const DECISIONS = 39;
const STATUSES = new Set(['planned', 'partial', 'done', 'accepted']);
const DECISION_STATUSES = new Set(['open', 'assumed', 'decided']);
const TRACE_FILES = [
  'docs/traceability/requirements.md',
  'docs/traceability/screens-journeys-acceptance.md',
];

interface Row {
  id: string;
  step: string;
  status: string;
  evidence: string;
}

/** Table rows whose first cell is a spec id; the last three cells are step, status, evidence. */
function traceRows(): Row[] {
  return TRACE_FILES.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => /^\| (FR|UI|JY|UAT)-/.test(line))
      .map((line) => {
        const cells = line.split('|').map((cell) => cell.trim());
        const [step = '', status = '', evidence = ''] = cells.slice(-4, -1);
        return { id: cells[1] ?? '', step, status, evidence };
      }),
  );
}

const planSteps = new Set(readFileSync('docs/PLAN.md', 'utf8').match(/\*\*M\d+\.\d+/g) ?? []);
const rows = traceRows();

describe('traceability: every spec item has exactly one planned home', () => {
  it.each(Object.entries(EXPECTED))('lists all %s items once', (kind, count) => {
    const ids = rows.filter((row) => row.id.startsWith(`${kind}-`)).map((row) => row.id);
    expect(ids).toHaveLength(count);
    expect(new Set(ids).size).toBe(count);
  });

  it('maps every item to a step that exists in docs/PLAN.md', () => {
    const missing = rows.filter((row) => !planSteps.has(`**${row.step}`));
    expect(missing.map((row) => `${row.id} -> ${row.step}`)).toEqual([]);
  });

  it('uses only known statuses, and implemented items cite an existing test', () => {
    expect(rows.filter((row) => !STATUSES.has(row.status)).map((row) => row.id)).toEqual([]);
    const implemented = rows.filter((row) => row.status !== 'planned');
    const unproven = implemented.filter((row) => !existsSync(row.evidence.replaceAll('`', '')));
    expect(unproven.map((row) => `${row.id}: ${row.evidence}`)).toEqual([]);
  });
});

describe('decision log', () => {
  const decisions = readFileSync('docs/DECISIONS.md', 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| DEC-'))
    .map((line) => line.split('|').map((cell) => cell.trim()));

  it('holds every decision once, with a known status and a planned step', () => {
    expect(new Set(decisions.map((cells) => cells[1])).size).toBe(DECISIONS);
    expect(decisions.filter((cells) => !DECISION_STATUSES.has(cells[5] ?? ''))).toEqual([]);
    expect(decisions.filter((cells) => !planSteps.has(`**${cells[4]}`))).toEqual([]);
  });
});
