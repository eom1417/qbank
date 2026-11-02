import type { FastifyInstance } from 'fastify';
import type { OutboxResponse } from '../../../contracts/dev.js';
import type { Db } from '../db/index.js';

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** The single way the app sends e-mail; the adapter is chosen at startup. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Local adapter (DEC-28): stores messages instead of sending them. A real one comes in M16.3. */
export function createOutboxMailer(db: Db, newId: () => string): Mailer {
  return {
    async send(message) {
      await db
        .insertInto('mail_outbox')
        .values({
          id: newId(),
          to_address: message.to,
          subject: message.subject,
          body_text: message.text,
        })
        .execute();
    },
  };
}

/**
 * Developer-only view of the outbox. Registered only when QBANK_DEV_OUTBOX=true, because the
 * messages contain password-reset links; never enable it on a shared deployment.
 */
export function registerOutboxRoute(app: FastifyInstance, db: Db) {
  app.get('/api/dev/outbox', async (): Promise<OutboxResponse> => {
    const rows = await db
      .selectFrom('mail_outbox')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    const messages = rows.map((row) => ({
      id: row.id,
      to: row.to_address,
      subject: row.subject,
      text: row.body_text,
      createdAt: row.created_at.toISOString(),
    }));
    return { messages };
  });
}
