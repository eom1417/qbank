import { linkMedia, type MediaLink } from '../../domain/media-links.js';
import { area, intersect, type MediaRegion } from '../../domain/media-regions.js';
import type { PipelinePicture } from '../../domain/pipeline/question.js';
import type { DraftQuestion, FileLines } from '../contract.js';
import { anchorLines, frameOfDraft } from './media-view.js';
import { overlaps } from '../../domain/page.js';

/** Table options remain text; data figures/tables are represented by the kept picture. */
function keepRegionWords(
  file: FileLines,
  questions: DraftQuestion[],
  regions: readonly MediaRegion[],
) {
  const inside = (id: number, region: MediaRegion) => {
    const line = file.lines[id];
    return !!line && line.page === region.page && overlaps(line.box, region.box);
  };
  const options = questions.flatMap((question) =>
    question.options.flatMap((option) => option.lines),
  );
  const visual = regions.filter((region) => !options.some((id) => inside(id, region)));
  for (const question of questions) {
    const kept = (id: number) => !visual.some((region) => inside(id, region));
    question.stem = question.stem.filter(kept);
    question.explanation = question.explanation.filter(kept);
  }
}

type Spot = PipelinePicture['spot'];

/** Two boxes on one page where most of the smaller one lies inside the other. */
function sameContent(spot: Spot, region: MediaRegion): boolean {
  if (spot.page !== region.page) return false;
  const smaller = Math.min(area(spot.box), area(region.box));
  return smaller > 0 && area(intersect(spot.box, region.box)) >= smaller * 0.7;
}

/** A rendered region and an embedded image covering the same physical content. */
const matches = (picture: PipelinePicture, region: MediaRegion) =>
  picture.imageClass !== 'handwriting_ink' && sameContent(picture.spot, region);

/** Rendered regions that are not a picture already read as text (its words are the content). */
export const newRegions = (regions: readonly MediaRegion[], read: readonly Spot[]) =>
  regions.filter((region) => !read.some((spot) => sameContent(spot, region)));

/** Reuse the source's geometric linker for figures/tables absent from the image-unit list. */
export function mergeRegions(
  file: FileLines,
  questions: DraftQuestion[],
  pictures: PipelinePicture[][],
  regions: readonly MediaRegion[],
): PipelinePicture[][] {
  const frames = questions.map((question) => ({
    ...frameOfDraft(file, question),
    stem: anchorLines(question)
      .map((id) => file.lines[id]?.text ?? '')
      .join(' '),
  }));
  const links = linkMedia(regions, frames);
  keepRegionWords(file, questions, regions);
  const output = pictures.map((group) =>
    group.filter((picture) => !regions.some((r) => matches(picture, r))),
  );
  for (const [index, link] of links.entries()) {
    const previous = pictures.findIndex((group) =>
      group.some((picture) => matches(picture, link.region)),
    );
    const explained = previous >= 0 && !!questions[previous]?.explanation.length;
    const question = explained ? previous : link.question;
    const existing = pictures[previous]?.find((picture) => matches(picture, link.region));
    const placed = existing && { picture: existing, stays: explained };
    output[question]?.push(regionPicture({ ...link, question }, index, placed));
  }
  return output;
}

/**
 * A picture the rules placed in its question's written explanation (after the answer) keeps that
 * place and certainty; otherwise (no explanation, or moved) the region's certainty decides.
 */
function placedRegion(
  link: MediaLink,
  { picture: existing, stays }: { picture: PipelinePicture; stays: boolean },
  region: Pick<PipelinePicture, 'spot' | 'imageClass' | 'ppi'>,
): PipelinePicture {
  const kept = (stays && existing.placement === 'explanation') || link.certain;
  const placement = kept ? existing.placement : 'explanation';
  return { ...existing, ...region, placement, certain: kept ? (existing.certain ?? true) : false };
}

/**
 * Region metadata survives into cropping, quality checks and the review card; a picture the
 * placement rules placed adds the region's kind and resolution to its own place.
 */
export function regionPicture(
  link: MediaLink,
  index: number,
  placed?: { picture: PipelinePicture; stays: boolean },
): PipelinePicture {
  const imageClass: PipelinePicture['imageClass'] =
    link.region.kind === 'table' ? 'table' : 'figure';
  const region = {
    spot: { page: link.region.page, box: link.region.box },
    imageClass,
    ppi: link.region.ppi,
  };
  if (placed) return placedRegion(link, placed, region);
  return {
    unitId: `region:${link.region.page}:${index}`,
    ...region,
    placement: link.certain ? 'question' : 'explanation',
    optionLetter: null,
    certain: link.certain,
  };
}
