import { describe, expect, it } from 'vitest';
import { createClient, ownerWithBank } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';
import { OPERATOR_PASSWORD, signedInOperator } from '../support/operator.js';

// M31 (DEC-40): the operator is declared by the server's configuration, never chosen in the app,
// and sees feedback, reset requests and the queue only: never anyone's banks.
const app = useTestApp();

const SOME_ID = '0b4f4a1e-7c3d-4c2a-9f0e-2d1b3c4d5e6f';
const OPERATOR_ROUTES: [method: 'GET' | 'POST', url: string][] = [
  ['GET', '/api/operator/feedback'],
  ['POST', `/api/operator/feedback/${SOME_ID}/close`],
  ['GET', '/api/operator/resets'],
  ['POST', `/api/operator/resets/${SOME_ID}/link`],
  ['GET', '/api/operator/queue'],
  ['GET', '/api/operator/status'],
];

type Client = ReturnType<typeof createClient>;
const call = (client: Client, [method, url]: (typeof OPERATOR_ROUTES)[0]) =>
  method === 'GET' ? client.get(url) : client.post(url, {});

describe('who the operator is (DEC-40)', () => {
  it('marks only the confirmed, declared e-mail as operator, in sign-in and /me', async () => {
    const { browser, signedUp, email } = await signedInOperator(app());
    // Signing up with the declared e-mail alone grants nothing: the shell confirms it after.
    expect(signedUp?.json().isOperator).toBe(false);
    expect((await browser.get('/api/auth/me')).json().isOperator).toBe(true);
    const again = createClient(app());
    const signIn = await again.post('/api/auth/sign-in', {
      email: email.toUpperCase(),
      password: OPERATOR_PASSWORD,
    });
    expect(signIn.json().isOperator).toBe(true);

    const { owner } = await ownerWithBank(app());
    expect((await owner.get('/api/auth/me')).json().isOperator).toBe(false);
  });

  it('names the operator to every visitor in /api/meta', async () => {
    const meta = (await createClient(app()).get('/api/meta')).json();
    expect(meta).toEqual({ mode: 'accounts', operatorName: 'Test Operator', signIn: 'password' });
  });
});

describe('what the operator may reach (DEC-40)', () => {
  it('refuses every operator route to a normal account (403) and to a visitor (401)', async () => {
    const { owner } = await ownerWithBank(app());
    const visitor = createClient(app());
    for (const route of OPERATOR_ROUTES) {
      const denied = await call(owner, route);
      expect(denied.statusCode, route[1]).toBe(403);
      expect(denied.json().error.code).toBe('operator_only');
      expect((await call(visitor, route)).statusCode, route[1]).toBe(401);
    }
  });

  it('lets the operator reach the console, and the queue reports the workers', async () => {
    const { browser } = await signedInOperator(app());
    const queue = await browser.get('/api/operator/queue');
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toEqual({ workers: 2, items: [] });
    expect((await browser.get('/api/operator/feedback')).statusCode).toBe(200);
    expect((await browser.get('/api/operator/resets')).statusCode).toBe(200);
  });

  it('never shows the operator anyone else’s banks', async () => {
    const { bankId } = await ownerWithBank(app(), 'Private cardiology');
    const { browser } = await signedInOperator(app());
    const banks = await browser.get('/api/banks');
    expect(banks.statusCode).toBe(200);
    expect(banks.body).not.toContain('Private cardiology');
    expect((await browser.get(`/api/banks/${bankId}`)).statusCode).toBe(404);
  });
});
