// The server has no e-mail (DEC-28 outbox): when a friend taps "forgot password", the owner prints
// the reset message QBank wrote for them and sends it by hand (WhatsApp, SMS).
// docker compose -f compose.server.yaml exec qbank node scripts/reset-link.mjs friend@example.com
import console from 'node:console';
import process from 'node:process';
import { loadConfig } from '../dist/src/server/platform/config/index.js';
import { createDb } from '../dist/src/server/platform/db/index.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/reset-link.mjs <email of the account>');
  process.exit(2);
}
const db = createDb(loadConfig().databaseUrl);
try {
  const message = await db
    .selectFrom('mail_outbox')
    .select(['body_text', 'created_at'])
    .where((eb) => eb(eb.fn('lower', ['to_address']), '=', email))
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  if (!message) {
    console.error(`No message for ${email}: ask them to tap "Forgot password" first.`);
    process.exitCode = 1;
  } else {
    console.log(`Written ${message.created_at.toISOString()}. Send this to them:\n`);
    console.log(message.body_text);
  }
} finally {
  await db.destroy();
}
