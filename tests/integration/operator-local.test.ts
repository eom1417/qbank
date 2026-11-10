import { describe, expect, it } from 'vitest';
import { pairedBrowser } from '../support/client.js';
import { LOCAL_META, useTestApp } from '../support/test-app.js';

// A local install has no operator (DEC-40): its one owner already is the whole audience.
const app = useTestApp({ local: true });

describe('no operator on a local install', () => {
  it('names nobody, marks nobody, and has no operator or feedback routes', async () => {
    expect((await app().inject({ url: '/api/meta' })).json()).toEqual(LOCAL_META);
    const { browser } = await pairedBrowser(app());
    expect((await browser.get('/api/auth/me')).json().isOperator).toBe(false);
    expect((await browser.post('/api/feedback', { message: 'Hi' })).statusCode).toBe(404);
    expect((await browser.get('/api/operator/feedback')).statusCode).toBe(404);
    expect((await browser.get('/api/operator/queue')).statusCode).toBe(404);
  });
});
