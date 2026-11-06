import { createReadStream, existsSync } from 'node:fs';
import { StartImportFields } from '../../../../contracts/sources.js';
import { notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { SourcesDeps } from './deps.js';
import { startImport } from './start-import.js';

/**
 * The sample bank (M28.1): ten questions with their answers and explanations printed, written for
 * QBank and shipped with it. Imported into the owner's bank like any file, by the rules only (no
 * AI, nothing leaves the computer), so a new owner studies within two minutes.
 */
export async function startSampleImport(deps: SourcesDeps, actor: Actor, bankId: string) {
  if (!existsSync(deps.samplePdf)) throw notFound();
  const fields = StartImportFields.parse({ rightsConfirmed: 'true', language: 'en' });
  const upload = { fileName: 'QBank sample bank.pdf', data: createReadStream(deps.samplePdf) };
  return startImport(deps, actor, bankId, fields, upload);
}
