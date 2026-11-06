import type { SupportReportResponse } from '../../../../contracts/portability.js';
import type { Actor } from '../../identity/index.js';
import type { PortabilityDeps } from './deps.js';

/**
 * A report to share when asking for help (FR-22-007): how QBank runs and how many things it
 * holds, never a question, file, note or name. The owner reads it before sharing it.
 */
export async function supportReport(
  deps: PortabilityDeps,
  actor: Actor,
): Promise<SupportReportResponse> {
  const banks = await deps.library.bankIdsOf(actor.accountId);
  const questions = await deps.questions.statusCounts(actor.accountId, null);
  return {
    mode: deps.mode,
    version: deps.version,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    banks: banks.length,
    questions,
    createdAt: deps.clock.now().toISOString(),
  };
}
