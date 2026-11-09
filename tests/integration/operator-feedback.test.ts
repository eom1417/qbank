import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { signedInOperator } from '../support/operator.js';
import { useTestApp } from '../support/test-app.js';

// M31 (B1): "send feedback" on a server reaches its operator, not a private GitHub repository.
const app = useTestApp();

describe('feedback to the operator (M31, B1)', () => {
  it('saves a note with its screen and version, and the operator sees who sent it', async () => {
    const { browser, payload } = await registeredBrowser(app());
    const sent = await browser.post('/api/feedback', {
      message: 'The import bar stays at 0%',
      screen: '/imports',
    });
    expect(sent.statusCode).toBe(204);

    const { browser: operator } = await signedInOperator(app());
    const list = (await operator.get('/api/operator/feedback')).json();
    const item = list.items.find((i: { message: string }) => i.message.includes('0%'));
    expect(item).toMatchObject({
      accountEmail: payload.email,
      accountName: payload.displayName,
      screen: '/imports',
      version: 'test',
      closedAt: null,
    });
  });

  it('lets the operator close a note, once, and 404s an unknown one', async () => {
    const { browser } = await registeredBrowser(app());
    await browser.post('/api/feedback', { message: 'Close me' });
    const { browser: operator } = await signedInOperator(app());
    const before = (await operator.get('/api/operator/feedback')).json();
    const id = before.items.find((i: { message: string }) => i.message === 'Close me').id;

    expect((await operator.post(`/api/operator/feedback/${id}/close`, {})).statusCode).toBe(204);
    const after = (await operator.get('/api/operator/feedback')).json();
    const closed = after.items.find((i: { id: string }) => i.id === id);
    expect(closed.closedAt).not.toBeNull();
    const unknown = '0b4f4a1e-7c3d-4c2a-9f0e-2d1b3c4d5e6f';
    expect((await operator.post(`/api/operator/feedback/${unknown}/close`, {})).statusCode).toBe(
      404,
    );
    expect((await operator.post('/api/operator/feedback/not-an-id/close', {})).statusCode).toBe(
      404,
    );
  });
});

describe('limits on sending feedback (M31, B1)', () => {
  it('refuses the 11th note in an hour and an empty or oversized one', async () => {
    const { browser } = await registeredBrowser(app());
    for (let i = 1; i <= 10; i += 1) {
      expect((await browser.post('/api/feedback', { message: `Note ${i}` })).statusCode).toBe(204);
    }
    const eleventh = await browser.post('/api/feedback', { message: 'Note 11' });
    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.json().error.code).toBe('too_many_attempts');

    const { browser: other } = await registeredBrowser(app());
    expect((await other.post('/api/feedback', { message: '' })).statusCode).toBe(400);
    const long = await other.post('/api/feedback', { message: 'x'.repeat(2001) });
    expect(long.statusCode).toBe(400);
    expect((await other.post('/api/feedback', { message: 'Still mine' })).statusCode).toBe(204);
  });

  it('needs a signed-in account', async () => {
    const response = await createClient(app()).post('/api/feedback', { message: 'Hello' });
    expect(response.statusCode).toBe(401);
  });
});
