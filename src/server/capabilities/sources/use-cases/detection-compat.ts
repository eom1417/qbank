import type { FileUnits } from '../adapters/pipeline-units.js';
import { rasterCache } from '../adapters/raster.js';
import { detect } from '../detection/detect.js';
import { defaultRender } from '../detection/link/media-ink.js';
import { pageLines } from '../domain/lines.js';
import type { PageText } from '../domain/page.js';
import { familyOf } from '../domain/pipeline/family.js';
import { orderPage, type UnitDraft } from '../domain/pipeline/units.js';
import type { PlacedFigure } from '../domain/questions.js';
import { asExtractedQuestion } from './detection-output.js';

/** Already-read pages keep the public reader seam without calling the retired parser. */
function unitsOf(pages: readonly PageText[], figures: readonly PlacedFigure[]): FileUnits {
  const units = pages.map((page) => {
    const text: UnitDraft[] = pageLines(page, null).map((line) => ({
      page: page.page,
      box: line.box,
      kind: 'text_line',
      text: line.text,
      ocr: null,
      imageClass: null,
      fingerprint: null,
      filler: null,
      source: page.visual ? 'text_layer' : 'ocr',
    }));
    const pictures: UnitDraft[] = figures
      .filter((figure) => figure.page === page.page)
      .map((figure) => ({
        page: page.page,
        box: figure.box,
        kind: 'image',
        text: null,
        ocr: null,
        imageClass: 'figure',
        fingerprint: null,
        filler: null,
        source: 'image',
      }));
    const size = { page: page.page, width: page.width, height: page.height };
    return { size, scanned: !page.visual, units: orderPage(size, [...text, ...pictures]) };
  });
  return {
    pages: units,
    family: familyOf(
      units.map((page) => page.size),
      units.flatMap((page) => page.units),
    ),
  };
}

/** Pure/injected page reading and file reading share the exact detection coordinator. */
export async function detectReadPages(
  file: string,
  pages: readonly PageText[],
  raster = rasterCache(file),
  figures: readonly PlacedFigure[] = [],
) {
  const units = unitsOf(pages, figures);
  const result = await detect(file, {
    lessons: null,
    reader: { units: async () => units, pages: async () => [...pages] },
    mediaRender: { ...defaultRender, grey: (_file, page) => raster(page), regions: async () => [] },
  });
  return result.questions.map(asExtractedQuestion);
}
