#!/usr/bin/env node
// Fake `codex` (Codex CLI) for tests: device sign-in, login status, structured `exec` runs.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers';
import console from 'node:console';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerFor, argAfter, leakedSecrets, readInput, readJson, writeJson } from './shared.mjs';

const args = process.argv.slice(2);
const authFile = join(process.env.CODEX_HOME ?? '', 'auth.json');
const claims = {
  email: 'learner@example.test',
  'https://api.openai.com/auth': { chatgpt_plan_type: 'plus' },
};
const idToken = ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

function login() {
  console.log('1. Open this link in your browser and sign in to your account');
  console.log('   \u001b[94mhttps://auth.openai.com/codex/device\u001b[0m');
  console.log('2. Enter this one-time code (expires in 15 minutes)');
  console.log('   \u001b[94mABCD-EFGH1\u001b[0m');
  // The user approves on the provider's page; the fake approves after a moment.
  setTimeout(
    () => {
      writeJson(authFile, {
        auth_mode: 'chatgpt',
        tokens: { id_token: idToken, access_token: 'cx-1', refresh_token: 'cr-1' },
      });
      console.log('Successfully logged in');
      process.exit(0);
    },
    Number(process.env.FAKE_CODEX_APPROVE_MS ?? 800),
  );
}

function status() {
  const auth = readJson(authFile);
  const ok = auth?.auth_mode === 'chatgpt' && auth.tokens?.access_token !== 'revoked';
  console.log(ok ? 'Logged in using ChatGPT' : 'Not logged in');
  process.exit(ok ? 0 : 1);
}

async function exec() {
  const prompt = await readInput(false);
  const auth = readJson(authFile);
  if (leakedSecrets().length > 0 || !prompt) {
    console.error(`leaked ${leakedSecrets()}`);
    process.exit(1);
  }
  if (auth?.tokens?.access_token === 'expired') {
    console.error('Error: 401 Unauthorized');
    process.exit(1);
  }
  writeJson(authFile, {
    ...auth,
    tokens: { ...auth.tokens, access_token: `${auth.tokens.access_token}+` },
  });
  const schema = readJson(argAfter(args, '--output-schema'));
  writeFileSync(
    argAfter(args, '-o'),
    JSON.stringify(answerFor(JSON.stringify(schema), args.includes('-i'))),
  );
}

if (args[0] === 'login' && args[1] === '--device-auth') login();
else if (args[0] === 'login' && args[1] === 'status') status();
else if (args[0] === 'exec') await exec();
else process.exit(2);
