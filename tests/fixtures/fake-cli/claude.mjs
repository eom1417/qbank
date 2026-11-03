#!/usr/bin/env node
// Fake `claude` (Claude Code CLI) for tests: sign-in by pasted code, status, structured runs.
import process from 'node:process';
import console from 'node:console';
import { join } from 'node:path';
import { answerFor, argAfter, leakedSecrets, readInput, readJson, writeJson } from './shared.mjs';

const args = process.argv.slice(2);
const home = process.env.CLAUDE_CONFIG_DIR ?? '';
const credentialsFile = join(home, '.credentials.json');
// Pasted codes the fake accepts, and the access token each one produces.
const CODES = { 'good-code': 'at-1', 'limited-code': 'limited', 'revoked-code': 'revoked' };

async function login() {
  process.stdout.write('Opening browser to sign in…\r\nIf the browser did not open, visit: ');
  process.stdout.write(
    '\u001b]8;;https://claude.com/cai/oauth/authorize?code=true&client_id=fake&state=s1\u0007link\u001b]8;;\u0007\r\n',
  );
  process.stdout.write('Paste code here if prompted > ');
  const token = CODES[await readInput(true)];
  if (!token) {
    process.stdout.write('\r\nInvalid code\r\n');
    process.exit(1);
  }
  writeJson(credentialsFile, {
    claudeAiOauth: { accessToken: token, refreshToken: 'rt-1', expiresAt: Date.now() + 3600_000 },
    organizationUuid: 'org-1',
  });
  writeJson(join(home, '.claude.json'), { oauthAccount: { emailAddress: 'learner@example.test' } });
  process.stdout.write('\r\nLogin successful.\r\n');
  process.exit(0);
}

function status() {
  const token = readJson(credentialsFile)?.claudeAiOauth?.accessToken;
  const loggedIn = Boolean(token) && token !== 'revoked';
  const email = readJson(join(home, '.claude.json'))?.oauthAccount?.emailAddress ?? null;
  console.log(
    JSON.stringify({
      loggedIn,
      authMethod: loggedIn ? 'claude.ai' : 'none',
      email,
      subscriptionType: 'max',
    }),
  );
}

function result(fields) {
  console.log(JSON.stringify({ type: 'system', subtype: 'init' }));
  console.log(
    JSON.stringify({ type: 'result', subtype: fields.is_error ? 'error' : 'success', ...fields }),
  );
}

async function run() {
  const input = await readInput(false);
  const credentials = readJson(credentialsFile);
  const token = credentials?.claudeAiOauth?.accessToken;
  if (leakedSecrets().length > 0)
    return result({ is_error: true, api_error_status: 500, result: `leaked ${leakedSecrets()}` });
  if (token === 'limited')
    return result({ is_error: true, api_error_status: 429, result: 'usage limit reached' });
  // Each run refreshes the access token, like the real CLI does when it expires.
  writeJson(credentialsFile, {
    ...credentials,
    claudeAiOauth: { ...credentials.claudeAiOauth, accessToken: `${token}+` },
  });
  const answer = answerFor(argAfter(args, '--json-schema') ?? '', input.includes('"type":"image"'));
  result({ is_error: false, result: JSON.stringify(answer), structured_output: answer });
}

if (args[0] === 'auth' && args[1] === 'login') await login();
else if (args[0] === 'auth' && args[1] === 'status') status();
else if (args.includes('-p')) await run();
else process.exit(2);
