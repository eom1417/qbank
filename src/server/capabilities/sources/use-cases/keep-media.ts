import { Readable } from 'node:stream';
import type { ImportedMedia, ReviewReason } from '../../questions/index.js';
import { cropRegion } from '../adapters/crops.js';
import { modalityOf } from '../domain/media-description.js';
import { withinBookLimits } from '../domain/media-limits.js';
import type { MediaLink } from '../domain/media-links.js';
import { qualityOf, type MediaQuality } from '../domain/media-quality.js';
import type { PageText } from '../domain/page.js';
import type { SourcesDeps } from './deps.js';
import type { ExtractedQuestion } from './extract-questions.js';

/** A picture cropped and measured, waiting to be stored with its question. */
export interface CroppedMedia {
  link: MediaLink;
  png: Buffer;
  width: number;
  height: number;
  quality: MediaQuality;
}

/** A kept picture is at most this large on disk. */
const MAX_CROP_BYTES = 10 * 1024 * 1024;

const add = (reasons: Map<number, ReviewReason[]>, question: number, reason: ReviewReason) => {
  const list = reasons.get(question) ?? [];
  if (!list.includes(reason)) list.push(reason);
  reasons.set(question, list);
};

/**
 * Crops the pictures that may be kept (FR-06-008) and measures them (FR-06-006). Questions
 * whose pictures are unsure, poor or not kept get a review reason instead of a silent guess.
 */
export async function cropMedia(
  file: string,
  pages: readonly PageText[],
  links: readonly MediaLink[],
) {
  const sizes = new Map(pages.map((page) => [page.page, page.width * page.height]));
  const { kept, dropped } = withinBookLimits(links, (page) => sizes.get(page) ?? 0);
  const reasons = new Map<number, ReviewReason[]>();
  dropped.forEach((link) => add(reasons, link.question, 'media_not_kept'));
  const cropped: CroppedMedia[] = [];
  for (const link of kept) {
    const crop = await cropRegion(file, link.region.page, link.region.box);
    const quality = qualityOf(crop.gray, link.region.ppi);
    if (!link.certain) add(reasons, link.question, 'media_uncertain');
    if (quality.low) add(reasons, link.question, 'media_low_quality');
    cropped.push({ link, png: crop.png, width: crop.width, height: crop.height, quality });
  }
  return { cropped, reasons };
}

/** Reading order of pictures: page, then top to bottom, then left to right. */
const readingOrder = (a: CroppedMedia, b: CroppedMedia) =>
  a.link.region.page - b.link.region.page ||
  a.link.region.box.y0 - b.link.region.box.y0 ||
  a.link.region.box.x0 - b.link.region.box.x0;

/** Stores the crops and ties them to their saved questions; the previous import's go. */
export async function storeMedia(
  deps: SourcesDeps,
  place: { ownerId: string; sourceId: string },
  cropped: readonly CroppedMedia[],
  questions: readonly ExtractedQuestion[],
) {
  const positions = new Map<number, number>();
  const items: ImportedMedia[] = [];
  for (const media of [...cropped].sort(readingOrder)) {
    const question = questions[media.link.question];
    const stored = await deps.blobs.put(Readable.from(media.png), MAX_CROP_BYTES);
    if (!question || stored === 'too_large') continue;
    const position = (positions.get(media.link.question) ?? 0) + 1;
    positions.set(media.link.question, position);
    const { region, certain } = media.link;
    items.push({
      questionPage: question.page,
      questionNumber: question.number,
      position,
      page: region.page,
      box: region.box,
      kind: region.kind,
      modality: modalityOf(region.kind, question.stem),
      certain,
      blobKey: stored.key,
      width: media.width,
      height: media.height,
      quality: media.quality,
    });
  }
  const unused = await deps.questions.replaceMedia(place, items, deps.clock.now());
  for (const key of unused) await deps.blobs.remove(key);
}
