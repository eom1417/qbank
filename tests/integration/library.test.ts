import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const testApp = useTestApp();
const app = () => testApp().app;

const signedInBrowser = async () => (await registeredBrowser(app())).browser;

describe('library: private banks', () => {
  it('starts empty, then lists the bank the owner created', async () => {
    const owner = await signedInBrowser();
    expect((await owner.get('/api/banks')).json()).toEqual({ banks: [] });

    const created = await owner.post('/api/banks', { name: '  Cardiology  ', subject: '' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'Cardiology', subject: null, archived: false });

    const list = (await owner.get('/api/banks')).json();
    expect(list.banks.map((b: { name: string }) => b.name)).toEqual(['Cardiology']);
  });

  it("hides another account's bank behind the same 404 as a missing one", async () => {
    const owner = await signedInBrowser();
    const stranger = await signedInBrowser();
    const bankId = (await owner.post('/api/banks', { name: 'Private' })).json().id;

    const foreign = await stranger.get(`/api/banks/${bankId}`);
    const missing = await stranger.get('/api/banks/00000000-0000-4000-8000-000000000000');
    const malformed = await stranger.get('/api/banks/not-an-id');
    expect(foreign.statusCode).toBe(404);
    expect(foreign.body).toBe(missing.body);
    expect(malformed.body).toBe(missing.body);
    expect((await stranger.get('/api/banks')).json()).toEqual({ banks: [] });
    expect((await owner.get(`/api/banks/${bankId}`)).statusCode).toBe(200);
  });

  it('keeps two banks with the same name apart', async () => {
    const owner = await signedInBrowser();
    const first = (await owner.post('/api/banks', { name: 'Same' })).json();
    const second = (await owner.post('/api/banks', { name: 'Same' })).json();
    expect(first.id).not.toBe(second.id);
  });

  it('requires a session and a valid name', async () => {
    const visitor = createClient(app());
    expect((await visitor.get('/api/banks')).statusCode).toBe(401);
    expect((await visitor.post('/api/banks', { name: 'x' })).statusCode).toBe(401);
    const owner = await signedInBrowser();
    const blank = await owner.post('/api/banks', { name: '   ' });
    expect(blank.json()).toEqual({
      error: { code: 'validation_failed', fields: { name: 'too_small' } },
    });
  });
});
