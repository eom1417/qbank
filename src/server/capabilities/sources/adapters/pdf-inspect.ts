import { runTool } from './run-tool.js';

export type PdfInspection =
  { ok: true; pages: number } | { ok: false; reason: 'file_corrupt' | 'file_protected' };

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
  return pages > 0 ? { ok: true, pages } : { ok: false, reason: 'file_corrupt' };
}
