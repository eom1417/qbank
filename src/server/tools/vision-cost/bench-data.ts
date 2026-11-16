/** Shapes of the bench's files under the data folder (manifest, key, sheets). */
import type { Size } from './sheet-layout.js';

/** Long edges every reduced variant is made at; the first is the "native" cap. */
export const SIZES = [1568, 1000, 700] as const;

export interface ImageRef extends Size {
  path: string;
}

export interface CropItem {
  page: number;
  question: number;
  /** Long edge to image. */
  sizes: Record<string, ImageRef>;
}

export interface PageItem {
  page: number;
  questions: number[];
  image: ImageRef;
}

export interface Manifest {
  dpi: number;
  pages: PageItem[];
  crops: CropItem[];
}

export interface KeyEntry {
  page: number;
  question: number;
  letter: string | null;
}

export interface Sheet {
  id: string;
  /** Panel label (1-based) to key entry, in panel order. */
  panels: KeyEntry[];
  sizes: Record<string, ImageRef>;
}
