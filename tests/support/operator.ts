import type { FastifyInstance } from 'fastify';
import { createDb } from '../../src/server/platform/db/index.js';
import { createClient, signUpPayload } from './client.js';
import { OPERATOR_EMAIL, testDatabaseUrl } from './test-app.js';

export const OPERATOR_PASSWORD = 'operator horse battery';

/** What scripts/confirm-operator.mjs does from the server's shell (DEC-40), for the test DB. */
export async function confirmOperator(email: string = OPERATOR_EMAIL) {
  const db = createDb(testDatabaseUrl());
  try {
    await db
      .updateTable('account')
      .set({ operator_confirmed_at: new Date() })
      .where('email', '=', email)
      .execute();
  } finally {
    await db.destroy();
  }
}

/**
 * A browser signed in as the operator (DEC-40): signs the declared e-mail up on first use in a
 * suite and confirms it as the shell would, and signs in afterwards. `signedUp` is the sign-up
 * response the first time, taken before the confirmation.
 */
export async function signedInOperator(app: FastifyInstance) {
  const browser = createClient(app);
  const payload = signUpPayload({
    email: OPERATOR_EMAIL,
    password: OPERATOR_PASSWORD,
    displayName: 'Operator',
  });
  const response = await browser.post('/api/auth/sign-up', payload);
  if (response.statusCode === 201) {
    await confirmOperator();
    return { browser, signedUp: response, email: OPERATOR_EMAIL };
  }
  await browser.post('/api/auth/sign-in', { email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD });
  return { browser, signedUp: null, email: OPERATOR_EMAIL };
}
