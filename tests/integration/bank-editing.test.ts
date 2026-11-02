import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

const names = (response: { json(): { banks: { name: string }[] } }) =>
  response.json().banks.map((bank) => bank.name);

describe('editing and archiving banks (FR-03-008, FR-19-008, UAT-004)', () => {
  it('renames a bank and clears its subject without changing its id', async () => {
    const { owner, bank } = await ownerWithBank(app());
    await owner.patch(`/api/banks/${bank.id}`, { subject: 'ECG' });
    const updated = await owner.patch(`/api/banks/${bank.id}`, { name: 'Heart', subject: '' });
    expect(updated.json()).toMatchObject({ id: bank.id, name: 'Heart', subject: null });
    expect((await owner.patch(`/api/banks/${bank.id}`, {})).statusCode).toBe(400);
  });

  it('hides an archived bank by default, lists it on request, and restores it intact', async () => {
    const { owner, bank } = await ownerWithBank(app(), 'Archived one');
    await owner.post('/api/banks', { name: 'Active one' });
    const archived = await owner.post(`/api/banks/${bank.id}/archive`);
    expect(archived.json().archived).toBe(true);

    expect(names(await owner.get('/api/banks'))).toEqual(['Active one']);
    expect(names(await owner.get('/api/banks?archived=only'))).toEqual(['Archived one']);
    expect(names(await owner.get('/api/banks?archived=include')).sort()).toEqual([
      'Active one',
      'Archived one',
    ]);

    const restored = await owner.post(`/api/banks/${bank.id}/restore`);
    expect(restored.json()).toMatchObject({ id: bank.id, name: 'Archived one', archived: false });
    expect((await owner.get('/api/banks?archived=bogus')).statusCode).toBe(400);
  });

  it("cannot edit, archive or restore another account's bank", async () => {
    const { bank } = await ownerWithBank(app());
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.patch(`/api/banks/${bank.id}`, { name: 'Mine' })).statusCode).toBe(404);
    expect((await stranger.post(`/api/banks/${bank.id}/archive`)).statusCode).toBe(404);
    expect((await stranger.post(`/api/banks/${bank.id}/restore`)).statusCode).toBe(404);
  });
});
