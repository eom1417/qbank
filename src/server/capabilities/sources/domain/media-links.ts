import type { MediaRegion } from './media-regions.js';
import type { Box } from './page.js';

/** What linking needs to know about a question: its text and where its lines are. */
export interface PlacedQuestion {
  stem: string;
  spans: readonly { page: number; box: Box }[];
}

/** A figure or table and the question it belongs to; `certain` false goes to review (M5.2). */
export interface MediaLink {
  region: MediaRegion;
  /** Index of the question in the extracted list. */
  question: number;
  certain: boolean;
}

// A stem that points at a picture: "the ECG below", "shown in the figure", "الصورة التالية".
const REFERS_TO_MEDIA =
  /\b(?:ECG|EKG|X-?ray|radiograph|CT|MRI|ultrasound|image|figure|picture|photo|shown|below|following|graph|chart|table)\b|الصورة|الشكل|التخطيط|الأشعة|الجدول|المرفق|التالي/i;

const refersToMedia = (stem: string) => REFERS_TO_MEDIA.test(stem);

/** Same column: the region and the line overlap horizontally over a fair part of the narrower. */
function sameColumn(a: Box, b: Box): boolean {
  const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  return overlap > 0.3 * Math.min(a.x1 - a.x0, b.x1 - b.x0);
}

/** The question's lines on the region's page, when that is the region's column. */
function linesNear(question: PlacedQuestion, region: MediaRegion) {
  const spans = question.spans.filter((span) => span.page === region.page);
  if (spans.length === 0) return null;
  const column = {
    x0: Math.min(...spans.map((span) => span.box.x0)),
    x1: Math.max(...spans.map((span) => span.box.x1)),
    y0: 0,
    y1: 0,
  };
  return sameColumn(column, region.box) ? spans : null;
}

/** The question's lines on the region's page and column, as one vertical extent. */
function extentNear(question: PlacedQuestion, region: MediaRegion) {
  const spans = linesNear(question, region);
  if (!spans) return null;
  return {
    top: Math.min(...spans.map((span) => span.box.y0)),
    bottom: Math.max(...spans.map((span) => span.box.y1)),
  };
}

/** Questions before and after the region: in its column on its page, else on other pages. */
function neighbours(questions: readonly PlacedQuestion[], region: MediaRegion) {
  const middle = (region.box.y0 + region.box.y1) / 2;
  let before = -1;
  let after = -1;
  questions.forEach((question, index) => {
    const extent = extentNear(question, region);
    const first = question.spans[0]?.page ?? 0;
    const last = question.spans.at(-1)?.page ?? 0;
    const isBefore = extent ? extent.bottom <= middle : last < region.page;
    const isAfter = extent ? extent.top >= middle : first > region.page;
    if (isBefore) before = index;
    if (isAfter && after < 0) after = index;
  });
  return { before, after };
}

/** The question a region between two questions most likely belongs to; never certain. */
function between(questions: readonly PlacedQuestion[], before: number, after: number) {
  if (before < 0) return after;
  if (after < 0) return before;
  const next = refersToMedia(questions[after]?.stem ?? '');
  const previous = refersToMedia(questions[before]?.stem ?? '');
  // Explanations and notes follow their question; a figure for the next one is announced.
  return next && !previous ? after : before;
}

/**
 * The region sits among the question's own lines: some before it and some after it, on
 * earlier or later pages or in its column on the same page.
 */
function brackets(question: PlacedQuestion, region: MediaRegion): boolean {
  const middle = (region.box.y0 + region.box.y1) / 2;
  const near = linesNear(question, region) ?? [];
  const before = question.spans.some((span) => span.page < region.page);
  const after = question.spans.some((span) => span.page > region.page);
  return (
    (before || near.some((span) => span.box.y1 <= middle)) &&
    (after || near.some((span) => span.box.y0 >= middle))
  );
}

/**
 * Links each region to its question by position (FR-06-001, FR-06-002). Among a question's
 * lines, even across a page break (FR-06-004), it is certain; between questions it is a
 * suggestion for review (UAT-027). A region with no question near it is not kept (FR-06-008).
 */
export function linkMedia(
  regions: readonly MediaRegion[],
  questions: readonly PlacedQuestion[],
): MediaLink[] {
  const links: MediaLink[] = [];
  for (const region of regions) {
    const inside = questions.findIndex((question) => brackets(question, region));
    if (inside >= 0) {
      links.push({ region, question: inside, certain: true });
      continue;
    }
    const { before, after } = neighbours(questions, region);
    const question = between(questions, before, after);
    if (question >= 0) links.push({ region, question, certain: false });
  }
  return links;
}
