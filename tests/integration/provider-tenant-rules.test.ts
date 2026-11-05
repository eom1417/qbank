import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { usePerAccountHosts } from '../support/ai-hosts.js';
import { ownerWithBank, type createClient } from '../support/client.js';

type Browser = ReturnType<typeof createClient>;

const { app, dir, served, requestsOf } = usePerAccountHosts();

const settingsWrite = (instance: Record<string, unknown>) => ({
  patch: {},
  providerInstanceMutation: { operation: 'create', instanceId: 'cursor-1', instance },
});

const rpc = (owner: Browser, method: string, input: object = {}) =>
  owner.post(`/api/providers/rpc/${method}`, input);

describe('an account on its own host may not change the server (DEC-35)', () => {
  it('refuses installs, updates and profile imports, which belong to the operator', async () => {
    const { owner } = await ownerWithBank(app());
    const account = (await served(owner)).account;
    for (const method of [
      'provider.install.start',
      'server.updateProvider',
      'server.prepareAcpRegistryAgent',
      'provider.chatgpt.import-profile',
    ])
      expect((await rpc(owner, method, { instanceId: 'own' })).statusCode).toBe(404);
    const install = await owner.get('/api/providers/events/provider.install.subscribe');
    expect(install.statusCode).toBe(404);
    expect(requestsOf(account)).toBe('');
  });

  it("accepts a driver's own key, and refuses a program path, a folder or another variable", async () => {
    const { owner } = await ownerWithBank(app());
    const account = (await served(owner)).account;
    const key = { name: 'CURSOR_API_KEY', value: 'k', sensitive: true };
    const ok = await rpc(
      owner,
      'server.updateSettings',
      settingsWrite({ driver: 'cursor', environment: [key] }),
    );
    expect(ok.statusCode).toBe(200);
    const refused = [
      { driver: 'cursor', environment: [{ ...key, name: 'LD_PRELOAD' }] },
      { driver: 'cursor', environment: [{ ...key, name: 'NODE_OPTIONS' }] },
      { driver: 'claudeAgent', environment: [key] },
      { driver: 'claudeAgent', config: { binaryPath: '/tmp/evil' } },
      { driver: 'claudeAgent', config: { homePath: '../other' } },
      { driver: 'codex', config: { setupMode: 'existing', launchArgs: ['--x'] } },
    ];
    for (const instance of refused)
      expect((await rpc(owner, 'server.updateSettings', settingsWrite(instance))).statusCode).toBe(
        400,
      );
    const patch = await rpc(owner, 'server.updateSettings', { patch: { worktreesDirectory: '/' } });
    expect(patch.statusCode).toBe(400);
    expect(requestsOf(account).match(/updateSettings/g)).toHaveLength(1);
  });
});

describe('deleting an account deletes its AI sign-ins (M22.4)', () => {
  it("stops the account's host and removes its folder, and leaves the other account's", async () => {
    const a = await ownerWithBank(app(), 'A');
    const b = await ownerWithBank(app(), 'B');
    const [hostA, hostB] = [(await served(a.owner)).account, (await served(b.owner)).account];
    const done = (await a.owner.post('/api/account/delete', { confirm: true })).json();
    expect(done.complete).toBe(true);
    expect(existsSync(join(dir, hostA))).toBe(false);
    expect(existsSync(join(dir, hostB))).toBe(true);
    expect((await served(b.owner)).account).toBe(hostB);
  });
});
