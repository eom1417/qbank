import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICIES } from '../../../src/contracts/sharing.js';
import {
  choiceProblem,
  codeMatches,
  endingOf,
  lockOf,
  personKeyOf,
  scoreOf,
} from '../../../src/server/capabilities/channels/domain/attempt.js';
import {
  attemptSize,
  drawQuestions,
  snapshotOf,
} from '../../../src/server/capabilities/channels/domain/attempt-draw.js';
import type { ShareState } from '../../../src/server/capabilities/channels/domain/policy.js';
import type { PoolQuestion } from '../../../src/server/capabilities/questions/index.js';

const question = (id: string, text = id): PoolQuestion => ({
  id,
  bankId: 'bank',
  chapterId: null,
  topicId: null,
  stem: `${text}?`,
  options: [
    { letter: 'A', label: 'A.', text: 'one' },
    { letter: 'B', label: 'B.', text: 'two' },
  ],
  answers: ['B'],
  multiSelect: false,
  explanation: null,
  version: 1,
  pictureIds: [],
  exactKey: text,
});

const pool = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => question(id));
const firstOf = () => 0;

describe('the draw of an attempt', () => {
  it('takes the fixed questions still ready, then fills the size at random', () => {
    const content = { size: 3, fixedQuestionIds: ['q5', 'gone'] };
    const drawn = drawQuestions(pool, content, Math.random) ?? [];
    expect(drawn).toHaveLength(3);
    expect(drawn.map((q) => q.id)).toContain('q5');
    expect(new Set(drawn.map((q) => q.id)).size).toBe(3);
  });

  it('asks every fixed question when there are more of them than the size', () => {
    const content = { size: 1, fixedQuestionIds: ['q1', 'q2'] };
    expect(attemptSize(content)).toBe(2);
    const drawn = drawQuestions(pool, content, firstOf) ?? [];
    expect(drawn.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('never asks the same text twice, and refuses a pool too small', () => {
    const twins = [question('a', 'same'), question('b', 'same'), question('c')];
    expect(drawQuestions(twins, { size: 3, fixedQuestionIds: [] }, firstOf)).toBeNull();
    const drawn = drawQuestions(twins, { size: 2, fixedQuestionIds: [] }, firstOf) ?? [];
    expect(new Set(drawn.map((q) => q.exactKey)).size).toBe(2);
  });

  it('keeps a snapshot of exactly what is asked', () => {
    const snapshot = snapshotOf(question('q1'));
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'answers',
        'chapterId',
        'explanation',
        'multiSelect',
        'options',
        'pictureIds',
        'stem',
        'version',
      ].sort(),
    );
  });
});

describe('the person taking it', () => {
  it('is the same person whatever the spaces and case of the name', () => {
    expect(personKeyOf('s', ' Sara   ALI ', 'x1')).toBe(personKeyOf('s', 'sara ali', 'X1'));
    expect(personKeyOf('s', 'Sara Ali')).not.toBe(personKeyOf('s', 'Sara Ali', 'x1'));
    expect(personKeyOf('s', 'Sara Ali')).not.toBe(personKeyOf('other', 'Sara Ali'));
  });

  it('gives the access code exactly, or not at all', () => {
    expect(codeMatches('ward-7', 'ward-7')).toBe(true);
    expect(codeMatches('ward-8', 'ward-7')).toBe(false);
    expect(codeMatches(undefined, 'ward-7')).toBe(false);
  });
});

const exam: ShareState = {
  kind: 'exam',
  policy: DEFAULT_POLICIES.exam,
  paused: false,
  endedAt: null,
  archivedAt: null,
};
const now = new Date('2026-12-01T10:00:00Z');
const active = { status: 'active' as const, position: 2, deadline_at: null };

describe('an attempt under way', () => {
  it('ends by time at its deadline, or by the owner when the share ends', () => {
    expect(endingOf(exam, active, now)).toBeNull();
    expect(endingOf(exam, { ...active, deadline_at: now }, now)).toBe('time');
    expect(endingOf({ ...exam, endedAt: now }, active, now)).toBe('owner');
    expect(endingOf({ ...exam, endedAt: now }, { ...active, status: 'submitted' }, now)).toBeNull();
  });

  it('locks going back when forward-only, an ended attempt, and a practice answer once seen', () => {
    const forward = { ...exam, policy: { ...exam.policy, limits: { ...exam.policy.limits } } };
    forward.policy.limits.navigation = 'forward';
    expect(lockOf(forward, active, { position: 1, chosen: null }, now)).toBe('question_locked');
    expect(lockOf(exam, active, { position: 1, chosen: null }, now)).toBeNull();
    const ended = { ...active, status: 'submitted' as const };
    expect(lockOf(exam, ended, { position: 2, chosen: null }, now)).toBe('exam_ended');
    const practice = { ...exam, kind: 'practice' as const, policy: DEFAULT_POLICIES.practice };
    expect(lockOf(practice, active, { position: 0, chosen: ['A'] }, now)).toBe('already_answered');
  });

  it('checks the letters chosen against the question', () => {
    const snapshot = snapshotOf(question('q1'));
    expect(choiceProblem(snapshot, ['B'])).toBeNull();
    expect(choiceProblem(snapshot, ['C'])).toBe('invalid_value');
    expect(choiceProblem(snapshot, ['A', 'B'])).toBe('too_big');
  });

  it('scores in percent to one decimal against the pass mark', () => {
    expect(scoreOf(2, 3, 60)).toEqual({ correct: 2, total: 3, percent: 66.7, passed: true });
    expect(scoreOf(1, 3, null)).toMatchObject({ percent: 33.3, passed: null });
  });
});
