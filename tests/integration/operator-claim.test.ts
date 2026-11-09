import { describe, expect, it } from 'vitest';
import { createClient, signUpPayload } from '../support/client.js';
import { confirmOperator } from '../support/operator.js';
import { OPERATOR_EMAIL, useTestApp } from '../support/test-app.js';

// DEC-40, M31 security fix: QBANK_OPERATOR_EMAIL only names the role. A stranger who signs up
// with that e-mail before the owner (the link is open to anyone) must gain nothing: no console,
// and above all no password-reset links, which would let them take over any account.
const app = useTestApp();

describe('signing up with the operator e-mail before the owner', () => {
  it('grants nothing until the server shell confirms the account', async () => {
    const intruder = createClient(app());
    const payload = signUpPayload({ email: OPERATOR_EMAIL, password: 'intruder password 1' });
    expect((await intruder.post('/api/auth/sign-up', payload)).json().isOperator).toBe(false);
    expect((await intruder.get('/api/auth/me')).json().isOperator).toBe(false);

    const victim = createClient(app());
    const victimEmail = 'victim@example.com';
    await victim.post('/api/auth/sign-up', signUpPayload({ email: victimEmail }));
    await createClient(app()).post('/api/auth/password-reset/request', { email: victimEmail });

    for (const url of ['/api/operator/resets', '/api/operator/feedback', '/api/operator/queue']) {
      const refused = await intruder.get(url);
      expect(refused.statusCode).toBe(403);
      expect(refused.json().error.code).toBe('operator_only');
    }
    const victimId = (await victim.get('/api/auth/me')).json().id as string;
    const link = await intruder.post(`/api/operator/resets/${victimId}/link`, {});
    expect(link.statusCode).toBe(403);
    expect(JSON.stringify(link.json())).not.toContain('reset-password');

    // Only what the owner does on the server's shell turns the role on.
    await confirmOperator();
    expect((await intruder.get('/api/auth/me')).json().isOperator).toBe(true);
    expect((await intruder.get('/api/operator/resets')).statusCode).toBe(200);
  });
});
