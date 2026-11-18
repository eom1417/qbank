import type { Box } from './page.js';

// What remains shared from the M3 question parser (retired in M39 for the line-role detection).

// "~*~*~*" rules and "Heart Murmurs (4 Questions)" headings close the current question.
const SEPARATOR = /^(?:[~*\s]{6,}|.*\(\d+\s+Questions?\))$/i;

/** A rule or a section heading with its count: never a question's or explanation's text. */
export const isSectionLine = (text: string) => SEPARATOR.test(text);

/** A figure or table on a page: the space it takes is not a gap between lines (M5). */
export interface PlacedFigure {
  page: number;
  box: Box;
}
