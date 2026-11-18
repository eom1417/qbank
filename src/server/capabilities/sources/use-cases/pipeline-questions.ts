import type { FileUnits } from '../adapters/pipeline-units.js';
import { rasterCache } from '../adapters/raster.js';
import { renderColourPage } from '../adapters/region-image.js';
import { detect } from '../detection/detect.js';
import { defaultLinesReader } from '../detection/lines/read-lines.js';
import { defaultRender } from '../detection/link/media-ink.js';
import { frameOfDraft, viewOf } from '../detection/link/media-view.js';
import { consumedPictures } from '../detection/link/media.js';
import type { Raster } from '../domain/answer-marks.js';
import type { PageText } from '../domain/page.js';
import type { FamilyVerdict } from '../domain/pipeline/family.js';
import { findLeftovers, type Leftover } from '../domain/pipeline/leftover.js';
import type { PipelineQuestion } from '../domain/pipeline/question.js';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';

/** Injected file IO stays compatible; every reader uses the same detection logic. */
export interface PipelineReaders {
  units(file: string): Promise<FileUnits>;
  pages(file: string, units: FileUnits): Promise<PageText[]>;
  raster(file: string): (page: number) => Promise<Raster>;
  colour(file: string, page: PageText, dpi: number): Promise<RgbImage>;
}

export const defaultReaders: PipelineReaders = {
  ...defaultLinesReader,
  raster: (file) => rasterCache(file),
  colour: renderColourPage,
};

export interface PipelineQuestions {
  questions: PipelineQuestion[];
  leftovers: Leftover[];
  units: FileUnits;
  family: FamilyVerdict;
}

/** Former pipeline entrypoint: IO adaptation only, with the common detector as its owner. */
export async function pipelineQuestions(
  file: string,
  readers: PipelineReaders = defaultReaders,
): Promise<PipelineQuestions> {
  const grey = readers.raster(file);
  const found = await detect(file, {
    lessons: null,
    reader: readers,
    mediaRender: {
      grey: (_file, page) => grey(page),
      colour: readers.colour,
      ...(readers === defaultReaders && defaultRender.regions
        ? { regions: defaultRender.regions }
        : {}),
    },
  });
  const { detection, questions } = found;
  const frames = detection.questions.map((question) => frameOfDraft(detection.file, question));
  const leftovers = findLeftovers({
    text: viewOf(detection.file),
    frames,
    keys: questions.map((question) => question.key),
    fromPicture: new Set(
      questions.flatMap((question, index) => (question.fromPicture ? [index] : [])),
    ),
    consumed: consumedPictures(detection.file, detection.roles, detection.questions),
  });
  const units = detection.file.units;
  return { questions, units, family: units.family, leftovers };
}
