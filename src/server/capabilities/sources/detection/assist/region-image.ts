import { createHash } from 'node:crypto';
import { unionBox } from '../../domain/page.js';
import { stackImages } from '../../adapters/question-crops.js';
import { renderRegion } from '../../adapters/region-image.js';
import type { FileLines } from '../contract.js';

/** Only OCR regions need pixels; text regions stay text-only and cost no rendering. */
export async function regionImage(
  fileName: string,
  file: FileLines,
  region: readonly number[],
  render = renderRegion,
) {
  const lines = region.flatMap((id) => file.lines[id] ?? []);
  if (!lines.some((line) => line.source !== 'text')) return null;
  const pages = [...new Set(lines.map((line) => line.page))];
  const images = [];
  for (const page of pages) {
    if (!file.pages.some((source) => source.page === page)) continue;
    const box = unionBox(lines.filter((line) => line.page === page).map((line) => line.box));
    images.push(await render(fileName, page, box, 150));
  }
  if (images.length === 0) return null;
  const image = stackImages(images);
  const fingerprint = createHash('sha256').update(image.data).digest('hex');
  return { image, fingerprint };
}
