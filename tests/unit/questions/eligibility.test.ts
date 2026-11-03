import { describe, expect, it } from 'vitest';
import { acceptAiAnswer } from '../../../src/server/capabilities/questions/domain/accept-ai.js';
import { withAnswerFile } from '../../../src/server/capabilities/questions/domain/answer-file.js';
import { suggestPlace } from '../../../src/server/capabilities/questions/domain/classify.js';
import { eligibilityOf } from '../../../src/server/capabilities/questions/domain/imported.js';

const base = {
  kind: 'mcq' as const,
  answers: ['A'],
  provenance: 'source' as const,
  reasons: [],
  aiAccepted: false,
};

describe('eligibility (FR-11-001, FR-11-002)', () => {
  it('only a trusted answer with nothing to review is eligible', () => {
    expect(eligibilityOf(base)).toBe('eligible');
    expect(eligibilityOf({ ...base, reasons: ['ocr_page'] })).toBe('needs_review');
    expect(eligibilityOf({ ...base, answers: [] })).toBe('needs_review');
    expect(eligibilityOf({ ...base, provenance: 'ai_suggested' })).toBe('needs_review');
    expect(eligibilityOf({ ...base, provenance: 'ai_suggested', aiAccepted: true })).toBe(
      'eligible',
    );
    expect(eligibilityOf({ ...base, kind: 'essay', answers: [], reasons: ['essay'] })).toBe(
      'detected',
    );
  });
});

const row = {
  kind: 'mcq' as const,
  options: [{ letter: 'A' }, { letter: 'B' }, { letter: 'C' }],
  answer_letters: [] as string[],
  answer_provenance: 'missing' as const,
  answer_evidence: null as string | null,
  review_reasons: ['no_answer'],
  status: 'needs_review',
  ai_answer_accepted_at: null,
};

describe('a separate answer file and an accepted AI answer (M6.3, M6.6)', () => {
  it('the file answers the question; a pen mark that disagrees is a conflict; manual stays', () => {
    expect(withAnswerFile(row, ['B'])).toMatchObject({
      answer_letters: ['B'],
      answer_provenance: 'source',
      status: 'eligible',
    });
    const marked = {
      ...row,
      answer_letters: ['A'],
      answer_evidence: 'pen_mark',
      answer_provenance: 'source' as const,
      review_reasons: [],
    };
    expect(withAnswerFile(marked, ['B'])).toMatchObject({
      answer_provenance: 'conflict',
      review_reasons: ['key_conflict'],
    });
    expect(withAnswerFile({ ...row, answer_provenance: 'manual' }, ['B'])).toBeNull();
  });

  it('accepting keeps the AI badge and only clears its reason', () => {
    const suggested = {
      ...row,
      answer_letters: ['C'],
      answer_provenance: 'ai_suggested' as const,
      review_reasons: ['ai_suggested'],
    };
    expect(acceptAiAnswer(suggested, new Date(0))).toMatchObject({
      review_reasons: [],
      status: 'eligible',
    });
    expect(acceptAiAnswer(row, new Date(0))).toBeNull();
  });
});

describe('suggesting a chapter and topic (FR-08-002)', () => {
  const chapters = [
    { id: 'c1', name: 'Cardiology', topics: [{ id: 't1', name: 'Heart murmurs' }] },
    { id: 'c2', name: 'Nephrology', topics: [] },
  ];
  it('the longest name the question mentions, as whole words', () => {
    expect(suggestPlace('Typical heart murmurs in children?', chapters)).toEqual({
      chapterId: 'c1',
      topicId: 't1',
    });
    expect(suggestPlace('A nephrology referral is needed', chapters)).toEqual({
      chapterId: 'c2',
      topicId: null,
    });
    expect(suggestPlace('Cardiologyx is not a word', chapters)).toBeNull();
  });
});
