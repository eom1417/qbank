import type { DraftQuestion, FileLines, LineRole } from '../contract.js';
import { assemble } from './assemble.js';
import { attachMedia, type MediaRender } from './media.js';

/**
 * Step 4 (plan §3): the file's questions from its line roles (./assemble.ts), then their
 * pictures, cases, tags and pen-mark answers (./media.ts).
 */
export async function linkQuestions(
  fileName: string,
  file: FileLines,
  roles: LineRole[],
  render?: MediaRender,
): Promise<DraftQuestion[]> {
  return attachMedia(fileName, file, roles, assemble(file, roles), render);
}
