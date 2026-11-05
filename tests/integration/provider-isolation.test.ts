import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_ENHANCEMENTS } from '../../src/contracts/sources.js';
import { usePerAccountHosts } from '../support/ai-hosts.js';
import { ownerWithBank } from '../support/client.js';
import { runImports } from '../support/imports.js';

// A server setting that no host, and no provider tool it starts, may ever see.
process.env['QBANK_ISOLATION_PROBE'] = 'server-only';

const { app, seed, dir, served, requestsOf } = usePerAccountHosts();

describe('one AI host per account (DEC-35)', () => {
  it('gives each account its own host, folder and HOME, and nothing of the server', async () => {
    const a = await ownerWithBank(app(), 'A');
    const b = await ownerWithBank(app(), 'B');
    const [hostA, hostB] = [await served(a.owner), await served(b.owner)];
    expect(hostA.account).not.toBe(hostB.account);
    expect(hostA.home).toBe(join(dir, hostA.account, 'home'));
    expect(hostB.home).toBe(join(dir, hostB.account, 'home'));
    for (const host of [hostA, hostB]) {
      expect(host.environment).not.toContain('QBANK_ISOLATION_PROBE');
      expect(host.environment.filter((name) => /DATABASE|QBANK/.test(name))).toEqual([]);
    }
    expect((await a.owner.get('/api/providers/access')).json()).toEqual({
      signIn: true,
      operator: false,
    });
  });

  it("sends an account's sign-in, settings and questions only to its own host", async () => {
    const a = await ownerWithBank(app(), 'A');
    const b = await ownerWithBank(app(), 'B');
    const [hostA, hostB] = [(await served(a.owner)).account, (await served(b.owner)).account];
    expect(
      (await a.owner.post('/api/providers/login', { method: 'claude.subscription' })).statusCode,
    ).toBeLessThan(500);
    const ids = await seed(a.owner, a.bankId, [{ stem: 'Which drug?', options: [] }]);
    const row = await app
      .db()
      .selectFrom('question')
      .select('source_id')
      .where('id', '=', ids[0] ?? '')
      .executeTakeFirstOrThrow();
    await a.owner.post(`/api/sources/${row.source_id}/recheck`, {
      aiProviderId: 'own',
      enhance: { ...NO_ENHANCEMENTS, verifyAnswers: true },
    });
    await runImports(app());
    expect(requestsOf(hostA)).toMatch(/POST \/login\/start/);
    expect(requestsOf(hostA)).toMatch(/POST \/ask/);
    expect(requestsOf(hostB)).toBe('');
  });
});

describe('browsing never starts a host (DEC-35)', () => {
  it('starts no host for an account that only browses, and starts one on its providers screen', async () => {
    const { owner } = await ownerWithBank(app(), 'Browsing');
    const before = readdirSync(dir).length;
    const peek = (await owner.get('/api/providers/state?peek=1')).json();
    expect(peek.providers).toEqual([]);
    expect((await owner.get('/api/health/details')).json().aiHost).toBe('reachable');
    expect(readdirSync(dir)).toHaveLength(before);
    const account = (await served(owner)).account;
    expect(existsSync(join(dir, account))).toBe(true);
    const again = (await owner.get('/api/providers/state?peek=1')).json();
    expect(again.served.account).toBe(account);
  });
});
