import { describe, expect, it } from 'vitest';
import { newShare } from '../support/channels.js';
import { pairedBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp({ local: true });

describe('links on an install nobody else can reach (local mode, DEC-39)', () => {
  it('refuses an exam or practice link, and still makes an agent share', async () => {
    const { browser: owner } = await pairedBrowser(app());
    const bankId = (await owner.post('/api/banks', { name: 'Medicine' })).json().id as string;
    for (const kind of ['exam', 'practice'] as const) {
      const refused = await newShare(owner, bankId, kind);
      expect(refused.response.statusCode).toBe(409);
      expect(refused.body.error.code).toBe('links_unavailable');
    }
    expect((await newShare(owner, bankId, 'agent')).response.statusCode).toBe(201);
    expect((await owner.get('/api/shares')).json().shares).toHaveLength(1);
  });
});
