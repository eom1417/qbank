// M34 P4, D6.1 in code: a picture is a page inside the page. Its OCR lines are read the way
// the rule parser reads a page: labels printed apart from their text, boxes instead of letters,
// and another bank's numbering, put in the forms the existing parser already reads.
import { answerLetter, optionLabel, questionLabel } from '../labels.js';
import type { TextLine } from '../lines.js';
import { unionBox } from '../page.js';

/** A label alone on its line ("A", "Cc" as OCR doubles it, "b)"), its text on the next line. */
const LONE_LABEL = /^\(?([A-Ja-j])\1?\s?[.)]?$/i;
/** "Answer" alone on its line, its letter on the next (an app's answer panel). */
const LONE_ANSWER = /^(?:correct\s+)?answer\s*:?$/i;

const joined = (first: TextLine, second: TextLine, text: string): TextLine => ({
  ...first,
  text,
  words: [...first.words, ...second.words],
  box: unionBox([first.box, second.box]),
});

/**
 * D2.2 inside a picture: an option label printed alone above its text, and an answer word
 * above its letter, are read as one line ("A. text", "Answer: A").
 */
export function joinLoneLabels(lines: readonly TextLine[]): TextLine[] {
  const result: TextLine[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as TextLine;
    const pair = joinPair(line, lines[index + 1]);
    result.push(pair ?? line);
    if (pair) index++;
  }
  return result;
}

/** A lone label (or answer word) and the line right under it as one line; null otherwise. */
function joinPair(line: TextLine, below: TextLine | undefined): TextLine | null {
  if (!below || !underneath(line, below)) return null;
  const label = LONE_LABEL.exec(line.text.trim())?.[1];
  const nextIsLabel = LONE_LABEL.test(below.text.trim());
  if (label && !nextIsLabel) return joined(line, below, `${label.toUpperCase()}. ${below.text}`);
  if (!LONE_ANSWER.test(line.text.trim()) || !nextIsLabel) return null;
  return joined(line, below, `Answer: ${below.text.trim().charAt(0).toUpperCase()}`);
}

/** `next` starts right under `line` (same left edge, within a line or two): its continuation. */
const underneath = (line: TextLine, next: TextLine) => {
  const height = line.box.y1 - line.box.y0;
  return (
    Math.abs(next.box.x0 - line.box.x0) <= height * 2 && next.box.y0 - line.box.y1 <= height * 2
  );
};

/** A tick box or radio button OCR reads as a letter-like glyph before an option's text. */
const BOX = /^[O0o○◯●□■©®@]\s?(?=[A-Z0-9])/;

/**
 * D2.2 inside a picture: options printed with boxes or radio buttons instead of letters take
 * positional letters ("○ Skin biopsy" → "B. Skin biopsy"), counted from each question line,
 * when at least two follow it.
 */
export function boxOptions(lines: readonly TextLine[]): TextLine[] {
  const runs: TextLine[][] = [[]];
  for (const line of lines) {
    if (questionLabel(line.text)) runs.push([]);
    if (BOX.test(line.text)) runs.at(-1)?.push(line);
  }
  const letters = new Map<TextLine, string>();
  for (const run of runs.filter((boxes) => boxes.length >= 2))
    run.forEach((line, index) => letters.set(line, answerLetter(index)));
  return lines.map((line) => {
    const letter = letters.get(line);
    return letter ? { ...line, text: `${letter}. ${line.text.replace(BOX, '').trim()}` } : line;
  });
}

const isOption = (line: TextLine) => optionLabel(line.text) !== null;
/** "Question 28/61": the count after the number is not part of the stem. */
const OF_COUNT = /^\/\s*\d+\s*/;

/**
 * D2.1 inside a picture (D6.1): a numbered line followed by options in the same picture is a
 * question whatever its number (a screenshot keeps another bank's numbering), and so is an
 * unnumbered first line followed by two options. Such lines are given the prefixed form the
 * parser always reads as a question; "12. b) …" (a key with its explanation) is not one.
 */
export function anchorPictureLines(lines: readonly TextLine[]): TextLine[] {
  const firstOption = lines.findIndex(isOption);
  const numbered = lines.slice(0, firstOption).some((other) => questionLabel(other.text));
  return lines.map((line, index) => {
    const options = lines.slice(index + 1).filter(isOption);
    const first = index === 0 && !numbered;
    const text =
      numberedAnchor(line.text, options.length) ??
      (first ? unnumberedAnchor(line.text, options) : null);
    return text ? { ...line, text } : line;
  });
}

/** "Question 28/61" without its count; "82. …" before two options as "Q82) …". */
function numberedAnchor(text: string, options: number): string | null {
  const label = questionLabel(text);
  if (label?.prefixed && OF_COUNT.test(label.text))
    return `Q${label.number}) ${label.text.replace(OF_COUNT, '')}`;
  const anchors = label && !label.prefixed && !optionLabel(label.text) && options >= 2;
  return anchors ? `Q${label.number}) ${label.text}` : null;
}

/** An unnumbered stem before options that start at the first letter, as "Q0) …". */
function unnumberedAnchor(text: string, options: readonly TextLine[]): string | null {
  if (questionLabel(text) || optionLabel(text) || options.length < 2) return null;
  return optionLabel(options[0]?.text ?? '')?.index === 0 ? `Q0) ${text}` : null;
}

/** "82. d) …": the answer to question 82 printed with its explanation, as screenshots show it. */
export function pictureKey(line: string): { number: number; letter: string; text: string } | null {
  const label = questionLabel(line);
  const option = label && !label.prefixed ? optionLabel(label.text) : null;
  if (!label || !option || option.system === 'digits') return null;
  return { number: label.number, letter: answerLetter(option.index), text: option.text.trim() };
}
