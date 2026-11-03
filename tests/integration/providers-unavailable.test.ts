import { describe, expect, it } from 'vitest';
import { registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

describe('without the AI host', () => {
  it('says plainly that the AI service is not running', async () => {
    const { browser } = await registeredBrowser(app());
    const state = await browser.get('/api/providers/state');
    expect([state.statusCode, state.json().error.code]).toEqual([503, 'ai_host_unavailable']);
  });
});
