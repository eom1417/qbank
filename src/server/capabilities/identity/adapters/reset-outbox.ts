import type { Db } from '../../../platform/db/index.js';

/**
 * Reads back the reset messages the outbox mailer wrote (DEC-28): a server without e-mail hands
 * them to its operator instead (DEC-40). Only the newest few to one address are ever read.
 */
export interface ResetOutbox {
  recentTo(address: string): Promise<string[]>;
}

export function createResetOutbox(db: Db): ResetOutbox {
  return {
    async recentTo(address) {
      const rows = await db
        .selectFrom('mail_outbox')
        .select('body_text')
        .where((eb) => eb(eb.fn('lower', ['to_address']), '=', address.toLowerCase()))
        .orderBy('created_at', 'desc')
        .limit(5)
        .execute();
      return rows.map((row) => row.body_text);
    },
  };
}
