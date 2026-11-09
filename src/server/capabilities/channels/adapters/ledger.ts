import type { ShareEventType } from '../../../../contracts/sharing.js';
import type { Db } from '../../../platform/db/index.js';

type EventDetail = Record<string, string | number | boolean | null>;

export interface ShareEvent {
  channelId: string;
  ownerId: string;
  type: ShareEventType;
  version: number;
  detail?: EventDetail;
}

/**
 * A share's append-only record and what has left the bank (DEC-39). Inserts only: no update and
 * no delete here; a record goes only with its share (cascade) or by the retention purge.
 */
export function createLedger(db: Db, deps: { newId(): string; now(): Date }) {
  return {
    record: async (event: ShareEvent) => {
      await db
        .insertInto('channel_event')
        .values({
          id: deps.newId(),
          channel_id: event.channelId,
          owner_id: event.ownerId,
          at: deps.now(),
          type: event.type,
          version: event.version,
          detail: JSON.stringify(event.detail ?? {}),
        })
        .execute();
    },
    eventsOf: (ownerId: string, channelId: string) =>
      db
        .selectFrom('channel_event')
        .select(['at', 'type', 'version', 'detail'])
        .where('owner_id', '=', ownerId)
        .where('channel_id', '=', channelId)
        .orderBy('at', 'desc')
        .limit(500)
        .execute(),
    /** Of these questions, the ones another share has already sent or asked. */
    exposedAmong: async (ownerId: string, questionIds: readonly string[], except?: string) => {
      if (questionIds.length === 0) return new Set<string>();
      const ids = [...questionIds];
      const other = except ?? '00000000-0000-0000-0000-000000000000';
      const sent = db
        .selectFrom('channel_delivery')
        .select((eb) => eb.cast<string | null>('question_id', 'uuid').as('question_id'))
        .where('owner_id', '=', ownerId)
        .where('channel_id', '!=', other)
        .where('question_id', 'in', ids);
      const asked = db
        .selectFrom('channel_attempt_item')
        .select('question_id')
        .where('owner_id', '=', ownerId)
        .where('channel_id', '!=', other)
        .where('question_id', 'in', ids);
      const rows = await sent.union(asked).execute();
      return new Set(rows.flatMap((row) => (row.question_id ? [row.question_id] : [])));
    },
  };
}
export type Ledger = ReturnType<typeof createLedger>;
