import { describe, expect, it } from 'vitest';
import {
  triagedValues,
  type TriageChange,
} from '../../../src/server/capabilities/questions/domain/triaged.js';

const change: TriageChange = {
  kind: 'mcq',
  stem: 'Which?',
  options: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, label: letter, text: letter })),
  answers: ['B'],
  provenance: 'ai_verified',
  evidence: 'ai_consensus',
  fileAnswer: null,
  aiNote: 'B fits.',
  settled: true,
  improved: false,
};

describe('a triaged question (DEC-33)', () => {
  it('drops the doubts a settled answer answers and becomes eligible', () => {
    const values = triagedValues(['no_answer', 'ai_read', 'media_not_kept', 'ocr_page'], change);
    expect(values.review_reasons).toEqual(['ocr_page']);
    expect(values.status).toBe('eligible');
  });

  it('keeps a real doubt: an unsettled answer waits for a person', () => {
    const open = { ...change, settled: false, provenance: 'conflict' as const };
    const values = triagedValues(['ai_suggested'], open);
    expect(values.review_reasons).toEqual(['ai_suggested', 'ai_disagrees']);
    expect(values.status).toBe('needs_review');
  });

  it('lets an open question the improver re-read rest as detected, not in review', () => {
    const essay = {
      ...change,
      kind: 'essay' as const,
      options: [],
      answers: [],
      settled: false,
      improved: true,
      provenance: 'missing' as const,
    };
    const values = triagedValues(['essay', 'ai_read', 'ocr_page'], essay);
    expect(values.review_reasons).toEqual(['essay', 'ocr_page']);
    expect(values.status).toBe('detected');
  });

  it('turns an improved open question with options into multiple choice', () => {
    const values = triagedValues(['essay', 'no_answer'], { ...change, improved: true });
    expect(values).toMatchObject({ kind: 'mcq', status: 'eligible', review_reasons: [] });
  });
});
