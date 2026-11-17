import { describe, expect, it } from 'vitest';
import {
  assemble,
  assignRoles,
  parseRole,
  rolesFor,
  unknownShapePages,
  type RoleBlock,
} from '../../../src/server/capabilities/sources/domain/pipeline/roles.js';
import type { Unit } from '../../../src/server/capabilities/sources/domain/pipeline/units.js';
import { pipelineQuestion } from '../../support/lesson-world.js';

// M34 P6 (Q26): each unit's role from the final questions, and a question re-assembled from
// corrected roles. Synthetic text only.

let order = 0;
const unit = (page: number, kind: Unit['kind'], text: string | null): Unit => ({
  id: `p${page}-u${order}`,
  page,
  box: { x0: 10, y0: 10 + order * 12, x1: 300, y1: 20 + order * 12 },
  kind,
  text,
  ocr: null,
  imageClass: kind === 'image' ? 'figure' : null,
  fingerprint: null,
  order: order++,
  filler: kind === 'filler' ? 'repeated' : null,
  source: 'text_layer',
});

function world() {
  order = 0;
  const units = [
    unit(1, 'text_line', '1. Which synthetic drug comes first?'),
    unit(1, 'text_line', 'A. Alphamycin'),
    unit(1, 'text_line', 'B. Betamycin'),
    unit(1, 'image', null),
    unit(1, 'text_line', 'Betamycin acts within minutes.'),
    unit(1, 'filler', 'Header of every page'),
    unit(1, 'text_line', 'A stray line nobody kept'),
    unit(1, 'text_line', '2. Which synthetic test follows?'),
    unit(1, 'text_line', 'A. Gammatest'),
    unit(1, 'text_line', 'B. Deltatest'),
  ];
  const first = pipelineQuestion('AB', {
    stem: 'Which synthetic drug comes first?',
    options: [
      { letter: 'A', label: 'A', text: 'Alphamycin', spot: null },
      { letter: 'B', label: 'B', text: 'Betamycin', spot: null },
    ],
    explanation: 'Betamycin acts within minutes.',
    pictures: [
      {
        unitId: 'p1-u3',
        spot: { page: 1, box: units[3]?.box ?? { x0: 0, y0: 0, x1: 1, y1: 1 } },
        placement: 'explanation',
        optionLetter: null,
        imageClass: 'figure',
      },
    ],
  });
  const second = pipelineQuestion('AB', {
    key: '1-2-0',
    number: 2,
    stem: 'Which synthetic test follows?',
    options: [
      { letter: 'A', label: 'A', text: 'Gammatest', spot: null },
      { letter: 'B', label: 'B', text: 'Deltatest', spot: null },
    ],
  });
  return { units, questions: [first, second] };
}

describe('roles of units (Q26)', () => {
  it('names what each unit became, in reading order', () => {
    const { units, questions } = world();
    const roles = assignRoles(units, questions).map((r) => [r.unit.id, r.role, r.question]);
    expect(roles).toEqual([
      ['p1-u0', 'stem', 0],
      ['p1-u1', 'option:A', 0],
      ['p1-u2', 'option:B', 0],
      ['p1-u3', 'picture:explanation', 0],
      ['p1-u4', 'explanation', 0],
      ['p1-u5', 'filler', null],
      ['p1-u6', 'dropped', null],
      ['p1-u7', 'stem', 1],
      ['p1-u8', 'option:A', 1],
      ['p1-u9', 'option:B', 1],
    ]);
  });

  it('accepts only known roles, and offers text and picture roles by kind', () => {
    expect(parseRole('option:C')).toBe('option:C');
    expect(parseRole('picture:option:B')).toBe('picture:option:B');
    expect(parseRole('option:Z')).toBeNull();
    expect(parseRole('owner')).toBeNull();
    expect(rolesFor('text_line', ['A'])).toContain('option:A');
    expect(rolesFor('image', ['A'])).toEqual([
      'picture:question',
      'picture:option:A',
      'picture:explanation',
      'case',
      'filler',
      'dropped',
    ]);
  });
});

const block = (order: number, role: RoleBlock['role'], text: string | null, kind = 'text_line') =>
  ({ unitId: `p1-u${order}`, page: 1, order, kind, text, role }) as RoleBlock;

describe('re-assembly (Q26)', () => {
  it('rebuilds the text verbatim from the units and places the pictures', () => {
    const rebuilt = assemble([
      block(4, 'explanation', 'Betamycin acts within minutes.'),
      block(0, 'stem', '1. Which synthetic drug'),
      block(1, 'stem', 'comes first?'),
      block(2, 'option:A', 'A. Alphamycin'),
      block(3, 'option:B', 'B. Betamycin'),
      block(5, 'picture:option:B', null, 'image'),
      block(6, 'dropped', 'A stray line'),
    ]);
    expect(rebuilt).toEqual({
      stem: 'Which synthetic drug comes first?',
      options: [
        { letter: 'A', text: 'Alphamycin' },
        { letter: 'B', text: 'Betamycin' },
      ],
      explanation: 'Betamycin acts within minutes.',
      pictures: [{ unitId: 'p1-u5', placement: 'option', optionLetter: 'B' }],
    });
  });

  it('has no explanation when no unit is one, and keeps filler out', () => {
    const rebuilt = assemble([block(0, 'stem', 'Q1) Stem'), block(1, 'filler', 'Footer')]);
    expect(rebuilt.stem).toBe('Stem');
    expect(rebuilt.explanation).toBeNull();
    expect(rebuilt.options).toEqual([]);
  });
});

describe('pages of unknown shape', () => {
  it('are pages whose content became no part of any question', () => {
    const pages = unknownShapePages([
      { page: 1, kind: 'text_line', role: 'stem' },
      { page: 2, kind: 'text_line', role: 'dropped' },
      { page: 2, kind: 'image', role: 'dropped' },
      { page: 3, kind: 'filler', role: 'filler' },
    ]);
    expect(pages).toEqual([2]);
  });
});
