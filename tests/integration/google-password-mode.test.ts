import { describe, expect, it } from 'vitest';
import { createClient } from '../support/client.js';
import { seedAccount } from '../support/fake-google.js';
import { OPERATOR_EMAIL, useTestApp } from '../support/test-app.js';

// M32 (DEC-42): a server that goes back from Google to passwords. Accounts made by Google have no
// password, so password sign-in never reaches them, and a Google link proves nothing here.
const app = useTestApp();

describe('a password server', () => {
  it('signs in with passwords and says so', async () => {
    expect((await createClient(app()).get('/api/meta')).json().signIn).toBe('password');
    expect((await createClient(app()).get('/api/auth/google/start')).statusCode).toBe(404);
  });

  it('never signs an account without a password in', async () => {
    const email = 'nopassword@gmail.test';
    await seedAccount(app.db(), { email, passwordHash: null, googleSub: 'sub-nopassword' });
    const attempt = await createClient(app()).post('/api/auth/sign-in', {
      email,
      password: 'any password at all',
    });
    expect(attempt.statusCode).toBe(401);
    expect(attempt.json().error.code).toBe('invalid_credentials');
  });

  it('still needs the shell to confirm the operator, even one linked to Google', async () => {
    const operator = { email: OPERATOR_EMAIL, passwordHash: null, googleSub: 'sub-operator' };
    const { cookie } = await seedAccount(app.db(), operator);
    const headers = { cookie };
    const me = await app().inject({ url: '/api/auth/me', headers });
    expect(me.json()).toMatchObject({ email: OPERATOR_EMAIL, isOperator: false });
    expect((await app().inject({ url: '/api/operator/resets', headers })).statusCode).toBe(403);
  });
});
