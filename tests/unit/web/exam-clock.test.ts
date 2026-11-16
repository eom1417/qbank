import { describe, expect, it } from 'vitest';
import { clockText } from '../../../src/web/capabilities/exam-ui/clock-text.js';

describe('the exam clock reads as minutes and seconds (M34 U1)', () => {
  it('shows minutes:seconds under an hour, the seconds always two digits', () => {
    expect(clockText(1794)).toBe('29:54');
    expect(clockText(600)).toBe('10:00');
    expect(clockText(59)).toBe('0:59');
    expect(clockText(5)).toBe('0:05');
    expect(clockText(0)).toBe('0:00');
  });

  it('adds the hours, with two-digit minutes, from an hour up', () => {
    expect(clockText(3600)).toBe('1:00:00');
    expect(clockText(3909)).toBe('1:05:09');
    expect(clockText(36000 + 59)).toBe('10:00:59');
  });

  it('never shows a negative or broken time', () => {
    expect(clockText(-3)).toBe('0:00');
    expect(clockText(12.7)).toBe('0:12');
  });
});
