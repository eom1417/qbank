import type { QueueItem } from '../../../../contracts/operator.js';
import type { SourcesDeps } from './deps.js';

/** The longest queue the operator's card lists; a server this size never comes close. */
const MAX_LISTED = 200;

/**
 * The server-wide import queue for the operator (M31, B2): running imports, then waiting ones in
 * their fair order. Who and how big only, never a file's name or content.
 */
export async function listQueue(
  deps: Pick<SourcesDeps, 'imports' | 'clock'>,
): Promise<QueueItem[]> {
  const rows = await deps.imports.listQueue(deps.clock.now(), MAX_LISTED);
  return rows.map((row) => ({
    jobId: row.id,
    accountEmail: row.email,
    pagesTotal: row.pages_total,
    pagesDone: row.pages_done,
    state: row.state,
    since: row.since.toISOString(),
  }));
}
