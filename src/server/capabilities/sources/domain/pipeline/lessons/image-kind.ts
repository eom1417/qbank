// M34 P4b: lesson D1.2 (curriculum level 1) — what kind of picture a pasted image is, asked only
// for images the code classed `unsure`. Cues are synthetic, never from a file.
import { z } from 'zod';
import type { LessonCard } from '../lesson.js';

export const IMAGE_KINDS = ['printed_words', 'handwriting', 'picture', 'table', 'mixed'] as const;
type ImageKind = (typeof IMAGE_KINDS)[number];

/** One unsure image: the unit it came from (the crop itself is the item's picture). */
export interface ImageKindInput {
  unitId: string;
}

export interface ImageKindOutput {
  kind: ImageKind;
}

export const imageKindLesson: LessonCard<ImageKindInput, ImageKindOutput> = {
  id: 'D1.2',
  level: 1,
  needs: 'vision',
  version: 1,
  question:
    'What is this image mostly? "printed_words" (typed text, e.g. a screenshot of a page), ' +
    '"handwriting" (pen or marker writing), "picture" (a medical image, photo or drawing), ' +
    '"table" (rows and columns of cells), or "mixed" (two of these in comparable amounts). Reply the kind.',
  yesCues: [
    'printed_words: lines of typed letters, even small or in a colored box',
    'handwriting: uneven strokes in pen, often blue or red',
    'picture: an X-ray, a skin photo, an ECG strip, a diagram with few words',
    'table: a grid of ruled cells holding words or numbers',
  ],
  noCues: [
    'a few labels on a picture do not make it printed_words',
    'a highlight over typed words does not make it handwriting',
  ],
  schema: z.object({ kind: z.enum(IMAGE_KINDS) }),
  // The schema already limits the reply to the five kinds: nothing more to check.
  check: () => null,
  reviewReason: 'image_kind_unclear',
};
