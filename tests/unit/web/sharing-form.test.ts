import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICIES } from '../../../src/contracts/sharing.js';
import {
  fromLocalInput,
  numberOrNull,
  toggleChapter,
  toLocalInput,
  withAccess,
  withCurrent,
} from '../../../src/web/capabilities/channels/policy-form.js';
import {
  mostMissedFirst,
  percentText,
} from '../../../src/web/capabilities/channels/results-order.js';

const A = '3f1c2a4b-5d6e-4f70-8a91-b2c3d4e5f601';
const B = '3f1c2a4b-5d6e-4f70-8a91-b2c3d4e5f602';
const C = '3f1c2a4b-5d6e-4f70-8a91-b2c3d4e5f603';

describe('policy form helpers', () => {
  it('reads "none" as null and keeps the current value among the choices', () => {
    expect(numberOrNull('none')).toBeNull();
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('30')).toBe(30);
    expect(withCurrent([5, 10], 7)).toEqual([7, 5, 10]);
    expect(withCurrent([5, null], null)).toEqual([5, null]);
  });

  it('round-trips a local date-time and refuses an empty or broken one', () => {
    const iso = fromLocalInput('2026-12-01T09:30');
    expect(iso).not.toBeNull();
    expect(toLocalInput(iso)).toBe('2026-12-01T09:30');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('not a date')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });

  it('adds and removes a chapter without touching the rest of the policy', () => {
    const one = toggleChapter(DEFAULT_POLICIES.exam, A);
    expect(one.content.chapterIds).toEqual([A]);
    expect(one.content.size).toBe(20);
    expect(toggleChapter(one, A).content.chapterIds).toEqual([]);
  });

  it('switches a people share between an open link and a code, keeping askId', () => {
    const asked = { ...DEFAULT_POLICIES.exam, audience: { access: 'open' as const, askId: true } };
    expect(withAccess(asked, 'code', 'ABCD').audience).toEqual({
      access: 'code',
      code: 'ABCD',
      askId: true,
    });
    expect(withAccess(asked, 'open', 'ABCD').audience).toEqual({ access: 'open', askId: true });
  });
});

describe('results order', () => {
  const q = (questionId: string, asked: number, correct: number) => ({
    questionId,
    stem: questionId,
    asked,
    answered: asked,
    correct,
  });

  it('puts the most missed first, the most asked first on a tie', () => {
    const order = mostMissedFirst([q(A, 10, 9), q(B, 4, 1), q(C, 8, 2)]).map((x) => x.questionId);
    expect(order).toEqual([C, B, A]);
    expect(mostMissedFirst([q(A, 0, 0), q(B, 2, 1)])[0]?.questionId).toBe(B);
  });

  it('shows a percent as a whole number, or a dash when there is none', () => {
    expect(percentText(66.6)).toBe('67%');
    expect(percentText(null)).toBe('—');
  });
});
