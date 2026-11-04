import { runTool } from './run-tool.js';

export type PdfInspection =
  | { ok: true; pages: number }
  | { ok: false; reason: 'file_corrupt' | 'file_protected' | 'page_too_large' };

/**
 * The longest page side read (in points, about 70 cm): renders stay bounded (M17.4). A real book
 * page is under 1,000; a crafted giant page would render into gigabytes.
 */
const MAX_PAGE_SIDE_PT = 2000;

/** Every page's size in one call; true when one is larger than any real page. */
async function hasGiantPage(path: string, pages: number) {
  const info = (await runTool('pdfinfo', ['-f', '1', '-l', String(pages), path], 60_000)).toString(
    'utf8',
  );
  const sizes = [...info.matchAll(/^Page\s+\d+\s+size:\s+([\d.]+) x ([\d.]+)/gm)];
  return sizes.some(([, w, h]) => Math.max(Number(w), Number(h)) > MAX_PAGE_SIDE_PT);
}

/**
 * What poppler says about an uploaded PDF before anything is read (FR-23-001): how many pages,
 * or why it cannot be read (damaged, or protected by a password or encryption).
 */
export async function inspectPdf(path: string): Promise<PdfInspection> {
  let info: string;
  try {
    info = (await runTool('pdfinfo', [path], 60_000)).toString('utf8');
  } catch (error) {
    const output = String((error as { stderr?: Buffer }).stderr ?? error);
    return {
      ok: false,
      reason: /password|encrypt/i.test(output) ? 'file_protected' : 'file_corrupt',
    };
  }
  if (/^Encrypted:\s+yes/im.test(info)) return { ok: false, reason: 'file_protected' };
  const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0);
  if (pages <= 0) return { ok: false, reason: 'file_corrupt' };
  if (await hasGiantPage(path, pages)) return { ok: false, reason: 'page_too_large' };
  return { ok: true, pages };
}
