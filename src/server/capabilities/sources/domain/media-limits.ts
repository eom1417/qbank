import type { MediaLink } from './media-links.js';
import { area } from './media-regions.js';

/** Kept pictures may cover at most this share of any page, and a question has at most this many. */
const MAX_PAGE_SHARE = 0.6;
const MAX_PER_QUESTION = 6;

/**
 * Only pictures tied to a question are kept, each smaller than its page, and never most of a
 * page: the saved crops cannot be put back together into the book (FR-06-008). What does not
 * fit is dropped, and its question says so in review.
 */
export function withinBookLimits(
  links: readonly MediaLink[],
  pageArea: (page: number) => number,
): { kept: MediaLink[]; dropped: MediaLink[] } {
  const used = new Map<number, number>();
  const perQuestion = new Map<number, number>();
  const kept: MediaLink[] = [];
  const dropped: MediaLink[] = [];
  for (const link of links) {
    const page = link.region.page;
    const share = (used.get(page) ?? 0) + area(link.region.box);
    const count = (perQuestion.get(link.question) ?? 0) + 1;
    if (share > pageArea(page) * MAX_PAGE_SHARE || count > MAX_PER_QUESTION) {
      dropped.push(link);
      continue;
    }
    used.set(page, share);
    perQuestion.set(link.question, count);
    kept.push(link);
  }
  return { kept, dropped };
}
