/**
 * Question regions from the PDF text layer (`pdftotext -bbox-layout` XHTML). A question's region
 * runs from its "Q<n>)" line to the line of the next question on the same page, or to the page
 * bottom. Coordinates are PDF points, top-left origin, as poppler writes them.
 */

interface TextLine {
  yMin: number;
  yMax: number;
  text: string;
}

export interface BboxPage {
  /** 1-based page number. */
  page: number;
  width: number;
  height: number;
  lines: TextLine[];
}

export interface QuestionRegion {
  page: number;
  question: number;
  /** Top edge in points. */
  top: number;
  /** Bottom edge in points. */
  bottom: number;
}

const PAGE_RE = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
const LINE_RE =
  /<line xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">([\s\S]*?)<\/line>/g;
const WORD_RE = /<word[^>]*>([^<]*)<\/word>/g;
const QUESTION_RE = /^Q(\d+)\)/;

function lineText(inner: string): string {
  return Array.from(inner.matchAll(WORD_RE), (m) => m[1] ?? '').join(' ');
}

function parseLines(body: string): TextLine[] {
  return Array.from(body.matchAll(LINE_RE), (m) => ({
    yMin: Number(m[1]),
    yMax: Number(m[2]),
    text: lineText(m[3] ?? ''),
  }));
}

export function parseBboxPages(xml: string): BboxPage[] {
  return Array.from(xml.matchAll(PAGE_RE), (m, index) => ({
    page: index + 1,
    width: Number(m[1]),
    height: Number(m[2]),
    lines: parseLines(m[3] ?? ''),
  }));
}

/** The question number a line opens, or null. */
export function questionNumber(text: string): number | null {
  const match = QUESTION_RE.exec(text.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Regions of every question that starts on the page. `pad` (points) widens each region upwards
 * so a mark just above the stem is kept; the bottom stops `pad` above the next question.
 */
export function findRegions(page: BboxPage, pad = 4): QuestionRegion[] {
  const starts = page.lines
    .map((line) => ({ line, question: questionNumber(line.text) }))
    .filter((s): s is { line: TextLine; question: number } => s.question !== null)
    .sort((a, b) => a.line.yMin - b.line.yMin);
  return starts.map((start, i) => {
    const next = starts[i + 1];
    const bottom = next ? next.line.yMin - pad : page.height;
    return {
      page: page.page,
      question: start.question,
      top: Math.max(0, start.line.yMin - pad),
      bottom: Math.max(start.line.yMax, bottom),
    };
  });
}

/** Points to pixels for a render at `dpi`. */
export function toPixels(points: number, dpi: number): number {
  return Math.round((points * dpi) / 72);
}
