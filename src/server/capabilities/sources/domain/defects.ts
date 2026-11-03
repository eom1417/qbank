import type { ReviewReason } from '../../questions/index.js';

/** What defect detection needs of a question. */
interface Checked {
  kind: 'mcq' | 'essay';
  stem: string;
  options: readonly { text: string }[];
}

/** Below this share of ordinary characters a text is garbled (a broken font, OCR noise). */
const MIN_READABLE_SHARE = 0.85;
const READABLE = /[\p{L}\p{N}\p{M}\s.,;:!?'"()[\]\-–—/%+=<>°×·…،؛؟«»]/u;

const normalized = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

function garbled(text: string): boolean {
  const chars = [...text];
  if (chars.length < 8) return false;
  if (text.includes('�')) return true;
  return chars.filter((char) => READABLE.test(char)).length / chars.length < MIN_READABLE_SHARE;
}

/**
 * Defects the rules can prove (FR-08-001, DEC-04: proven errors only): repeated options, a
 * multiple-choice question with fewer than two options, garbled text. Each holds the question
 * for review; nothing is rewritten here.
 */
export function defectsOf(question: Checked): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (question.kind === 'mcq' && question.options.length < 2) reasons.push('too_few_options');
  const texts = question.options.map((option) => normalized(option.text)).filter(Boolean);
  if (new Set(texts).size < texts.length) reasons.push('duplicate_options');
  if ([question.stem, ...question.options.map((o) => o.text)].some(garbled))
    reasons.push('garbled_text');
  return reasons;
}
