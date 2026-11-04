import { describe, expect, it } from 'vitest';
import { ORIGIN, useTestApp } from '../support/test-app.js';

// A local install serves its built web app from the API (DEC-31).
const app = useTestApp({ local: true, webDir: 'tests/fixtures/web-app' });

describe('the built web app', () => {
  it('serves the page, its files, and the page again for client-side routes', async () => {
    const home = await app().inject({ url: '/' });
    expect([home.statusCode, home.body]).toEqual([200, expect.stringContaining('QBank test page')]);
    expect((await app().inject({ url: '/assets/app.js' })).body).toContain('ready = true');
    const route = await app().inject({ url: '/banks/123' });
    expect(route.body).toContain('QBank test page');
  });

  it('keeps JSON errors for the API and refuses paths outside the build', async () => {
    const api = await app().inject({ url: '/api/nothing-here' });
    expect([api.statusCode, api.json()]).toEqual([404, { error: { code: 'not_found' } }]);
    const outside = await app().inject({ url: '/../../package.json' });
    expect(outside.body).not.toContain('"scripts"');
    const write = await app().inject({
      method: 'POST',
      url: '/somewhere',
      headers: { origin: ORIGIN },
    });
    expect(write.statusCode).toBe(404);
  });
});
