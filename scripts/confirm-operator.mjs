// Makes the server's operator real (DEC-40). QBANK_OPERATOR_EMAIL in .env only names the role:
// the account with that e-mail becomes the operator once someone with shell access on the server
// (you) confirms it here, after checking it is really yours. Whoever signed up first with that
// e-mail gains nothing until then.
// docker compose -f compose.server.yaml exec qbank node scripts/confirm-operator.mjs
import console from 'node:console';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { loadConfig } from '../dist/src/server/platform/config/index.js';
import { createDb } from '../dist/src/server/platform/db/index.js';

const config = loadConfig();
const email = config.operator.email;
if (config.mode !== 'accounts' || !email) {
  console.error('Set QBANK_OPERATOR_EMAIL in .env (and restart QBank) first.');
  process.exit(2);
}

/** Asks unless `--yes` was given (used by tests only). */
async function confirmed(question) {
  if (process.argv.includes('--yes')) return true;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question);
  prompt.close();
  return answer.trim().toLowerCase() === 'yes';
}

const db = createDb(config.databaseUrl);
try {
  const account = await db
    .selectFrom('account')
    .select(['id', 'display_name', 'created_at'])
    .where((eb) => eb(eb.fn('lower', ['email']), '=', email))
    .executeTakeFirst();
  if (!account) {
    console.error(`No account with ${email} yet: sign up with it in QBank, then run this again.`);
    process.exitCode = 1;
  } else {
    const when = account.created_at.toISOString();
    console.log(`Account ${email}: name "${account.display_name}", signed up ${when}.`);
    if (!(await confirmed('Is this your own account? Type yes to make it the operator: '))) {
      console.error(
        'Not confirmed. If it is not yours, put another e-mail of yours in QBANK_OPERATOR_EMAIL, ' +
          'restart QBank, sign up with it, and run this again.',
      );
      process.exitCode = 1;
    } else {
      // One operator at a time: a confirmation never lingers on an older account.
      await db.updateTable('account').set({ operator_confirmed_at: null }).execute();
      await db
        .updateTable('account')
        .set({ operator_confirmed_at: new Date() })
        .where('id', '=', account.id)
        .execute();
      console.log('Confirmed. Sign in with it: "Administration" now shows in the menu.');
    }
  }
} finally {
  await db.destroy();
}
