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

/** A rendered region and an embedded image covering the same physical content. */
function matches(picture: PipelinePicture, region: MediaRegion): boolean {
  if (picture.spot.page !== region.page || picture.imageClass === 'handwriting_ink') return false;
  const smaller = Math.min(area(picture.spot.box), area(region.box));
  return smaller > 0 && area(intersect(picture.spot.box, region.box)) >= smaller * 0.7;
}

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
    const question =
      previous >= 0 && questions[previous]?.explanation.length ? previous : link.question;
    const existing = pictures[previous]?.find((picture) => matches(picture, link.region));
    output[question]?.push(regionPicture({ ...link, question }, index, existing));
  }
  return output;
}

/** Region metadata survives into cropping, quality checks and the review card. */
function regionPicture(
  link: MediaLink,
  index: number,
  existing?: PipelinePicture,
): PipelinePicture {
  return {
    unitId: existing?.unitId ?? `region:${link.region.page}:${index}`,
    spot: { page: link.region.page, box: link.region.box },
    placement: link.certain ? (existing?.placement ?? 'question') : 'explanation',
    optionLetter: existing?.optionLetter ?? null,
    imageClass: link.region.kind === 'table' ? 'table' : 'figure',
    ppi: link.region.ppi,
    certain: link.certain,
  };
}
