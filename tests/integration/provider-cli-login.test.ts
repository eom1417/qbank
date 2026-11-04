import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registeredBrowser } from '../support/client.js';
import { startAiHost } from '../support/ai-host.js';
import { useTestApp } from '../support/test-app.js';

// Stand-ins for the official CLIs: the same prompts, a known good code and key.
const FAKE_CODEX = `#!/bin/sh
case "$*" in
  "login --device-auth")
    echo "1. Open this link in your browser and sign in to your account"
    echo "   https://auth.openai.com/codex/device"
    echo "2. Enter this one-time code (expires in 15 minutes)"
    echo "   ABCD-12EFG"
    sleep 1; echo "Successfully logged in"; exit 0 ;;
  "login --with-api-key")
    read key; [ "$key" = "sk-test-good" ] && exit 0; echo "Invalid API key"; exit 1 ;;
  logout) exit 0 ;;
esac
exit 2
`;
const FAKE_CLAUDE = `#!/bin/sh
case "$*" in
  "auth login --claudeai"|"auth login --console")
    echo "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true"
    printf "Paste code here if prompted > "
    read code; [ "$code" = "good-code" ] && { echo "Login successful."; exit 0; }
    echo "OAuth error: invalid code"; exit 1 ;;
  "auth logout") exit 0 ;;
esac
exit 2
`;

let bin = '';
let host: Awaited<ReturnType<typeof startAiHost>> | undefined;
beforeAll(async () => {
  bin = mkdtempSync(join(tmpdir(), 'qbank-cli-'));
  for (const [name, body] of [
    ['codex', FAKE_CODEX],
    ['claude', FAKE_CLAUDE],
  ] as const) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  host = await startAiHost({ binDir: bin });
}, 90_000);
afterAll(() => {
  host?.stop();
  rmSync(bin, { recursive: true, force: true });
});

const app = useTestApp({ aiHost: () => ({ url: host?.url ?? '', token: host?.token ?? null }) });
type Browser = Awaited<ReturnType<typeof registeredBrowser>>['browser'];

/** Polls a sign-in until it leaves the given statuses. */
async function until(browser: Browser, id: string, leave: readonly string[]) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const view = (await browser.get(`/api/providers/login/${id}`)).json();
    if (!leave.includes(view.status)) return view;
    await new Promise((wait) => setTimeout(wait, 250));
  }
  throw new Error('sign-in did not move on');
}

describe('signing in through the official CLIs, from any device', () => {
  it('Codex with ChatGPT: shows the link and the one-time code, then finishes', async () => {
    const { browser } = await registeredBrowser(app());
    const started = (
      await browser.post('/api/providers/login', { method: 'codex.chatgpt' })
    ).json();
    const waiting = await until(browser, started.id, ['starting']);
    expect(waiting).toMatchObject({
      provider: 'codex',
      link: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-12EFG',
      needsCode: false,
    });
    expect((await until(browser, started.id, ['waiting'])).status).toBe('done');
  });

  it('Claude: the pasted code finishes it, a wrong one fails with the reason', async () => {
    const { browser } = await registeredBrowser(app());
    for (const [code, status] of [
      ['good-code', 'done'],
      ['bad-code', 'failed'],
    ] as const) {
      const { id } = (
        await browser.post('/api/providers/login', { method: 'claude.subscription' })
      ).json();
      const waiting = await until(browser, id, ['starting']);
      expect(waiting).toMatchObject({
        needsCode: true,
        link: expect.stringContaining('https://claude.com/'),
      });
      expect((await browser.post(`/api/providers/login/${id}/code`, { code })).statusCode).toBe(
        200,
      );
      const end = await until(browser, id, ['waiting', 'verifying']);
      expect(end.status).toBe(status);
      expect(end.message ?? '').not.toContain(code);
    }
  });
});

describe('keys and boundaries of the CLI sign-in', () => {
  it('an API key goes in once and is never shown back', async () => {
    const { browser } = await registeredBrowser(app());
    const start = (secret: string) =>
      browser.post('/api/providers/login', { method: 'codex.apiKey', secret });
    const good = (await start('sk-test-good')).json();
    expect(JSON.stringify(good)).not.toContain('sk-test-good');
    expect((await until(browser, good.id, ['verifying'])).status).toBe('done');
    const bad = await until(browser, (await start('sk-test-bad')).json().id, ['verifying']);
    expect([bad.status, bad.message]).toEqual(['failed', 'Invalid API key']);
  });

  it("refuses bad input, and another account's sign-in is not found", async () => {
    const { browser: owner } = await registeredBrowser(app());
    const { browser: stranger } = await registeredBrowser(app());
    expect((await owner.post('/api/providers/login', { method: 'rm -rf' })).statusCode).toBe(400);
    expect((await owner.post('/api/providers/login', { method: 'codex.apiKey' })).statusCode).toBe(
      400,
    );
    const { id } = (await owner.post('/api/providers/login', { method: 'claude.console' })).json();
    expect((await stranger.get(`/api/providers/login/${id}`)).statusCode).toBe(404);
    expect((await stranger.post(`/api/providers/login/${id}/code`, { code: 'x' })).statusCode).toBe(
      404,
    );
    expect((await owner.post(`/api/providers/login/${id}/cancel`, {})).json().status).toBe(
      'failed',
    );
    expect((await owner.post('/api/providers/logout', { provider: 'claude' })).json()).toEqual({
      signedOut: true,
    });
  });
});
