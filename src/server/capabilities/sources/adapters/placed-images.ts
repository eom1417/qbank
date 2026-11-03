import type { Box } from '../domain/page.js';
import { runTool } from './run-tool.js';

/** An image drawn on a page: where (PDF points, top-left origin) and its own pixel size. */
export interface PlacedImage {
  box: Box;
  pixelWidth: number;
  pixelHeight: number;
}

const PAGE = /<page number="(\d+)"/;
const IMAGE = /<fill_image\b[^>]*\btransform="([^"]+)"[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/;

/** The image's unit square mapped by its transform `a b c d e f`, as a box. */
function boxOf(transform: string): Box | null {
  const values = transform.trim().split(/\s+/).map(Number);
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return null;
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = values;
  const xs = [e, a + e, c + e, a + c + e];
  const ys = [f, b + f, d + f, b + d + f];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Parses `mutool trace` output into the images drawn on each page. */
export function parseTrace(trace: string): Map<number, PlacedImage[]> {
  const pages = new Map<number, PlacedImage[]>();
  let current: PlacedImage[] = [];
  for (const line of trace.split('\n')) {
    const page = PAGE.exec(line);
    if (page) {
      current = [];
      pages.set(Number(page[1]), current);
      continue;
    }
    const image = IMAGE.exec(line);
    const box = image?.[1] ? boxOf(image[1]) : null;
    if (image && box)
      current.push({ box, pixelWidth: Number(image[2]), pixelHeight: Number(image[3]) });
  }
  return pages;
}

/** The images MuPDF draws on the given pages (embedded photos, ECG scans, pasted tables). */
export async function placedImages(
  file: string,
  pages: readonly number[],
): Promise<Map<number, PlacedImage[]>> {
  if (pages.length === 0) return new Map();
  const trace = await runTool('mutool', ['trace', file, pages.join(',')], 300_000);
  return parseTrace(trace.toString('utf8'));
}
