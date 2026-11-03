import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ContentPart, StructuredRequest } from '../../domain/ai-provider.js';
import { readJson, writePrivate, type AccountHome, type AccountSpec } from './account-home.js';
import {
  GENERATE_TIMEOUT_MS,
  runInHome,
  type AccountImpl,
  type CallOutcome,
  type Identity,
} from './account-ops.js';

/** Codex keeps a ChatGPT login in `auth.json` (`auth_mode: chatgpt`), never an API key here. */
const codexSpec: AccountSpec = {
  provider: 'codex',
  homeName: '.codex',
  envFor: (_root, home) => ({ CODEX_HOME: home }),
  write: (home, credential) => writePrivate(join(home, 'auth.json'), credential),
  async read(home) {
    const auth = await readJson(join(home, 'auth.json'));
    return auth && auth['auth_mode'] === 'chatgpt' ? JSON.stringify(auth) : null;
  },
};

const IdClaims = z.object({
  email: z.string().optional(),
  'https://api.openai.com/auth': z.object({ chatgpt_plan_type: z.string().optional() }).optional(),
});

/** Email and plan from the login's ID token (display only; the CLI itself checks the login). */
function claimsOf(auth: Record<string, unknown> | null): Identity {
  const tokens = auth?.['tokens'] as { id_token?: unknown } | undefined;
  const payload = typeof tokens?.id_token === 'string' ? tokens.id_token.split('.')[1] : undefined;
  try {
    const claims = IdClaims.parse(
      JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')),
    );
    return {
      email: claims.email ?? null,
      plan: claims['https://api.openai.com/auth']?.chatgpt_plan_type ?? null,
    };
  } catch {
    return { email: null, plan: null };
  }
}

/** `codex login status` says "Logged in using ChatGPT" for a subscription login. */
async function identify(bin: string, home: AccountHome): Promise<Identity | null> {
  const result = await runInHome(bin, home, ['login', 'status']);
  if (result.code !== 0 || !/ChatGPT/i.test(result.stdout + result.stderr)) return null;
  return claimsOf(await readJson(join(home.home, 'auth.json')));
}

function failureOf(stderr: string, timedOut: boolean): CallOutcome {
  if (timedOut) return { ok: false, failure: 'unreachable' };
  if (/401|unauthori[sz]ed|not logged in|log ?in again/i.test(stderr))
    return { ok: false, failure: 'invalid_key' };
  if (/usage limit|rate limit|429/i.test(stderr)) return { ok: false, failure: 'rate_limited' };
  return { ok: false, failure: 'unexpected' };
}

async function writeImages(home: AccountHome, parts: readonly ContentPart[]): Promise<string[]> {
  const files: string[] = [];
  for (const [index, part] of parts.entries()) {
    if (part.type !== 'image') continue;
    const file = join(
      home.root,
      `image-${index}.${part.mediaType === 'image/png' ? 'png' : 'jpg'}`,
    );
    await writeFile(file, Buffer.from(part.base64, 'base64'), { mode: 0o600 });
    files.push(file);
  }
  return files;
}

/**
 * One structured request through the official Codex CLI: read-only sandbox, no saved session,
 * output constrained by the schema file and written to a file.
 */
async function generate<T>(
  bin: string,
  home: AccountHome,
  model: string,
  request: StructuredRequest<T>,
) {
  const schemaFile = join(home.root, 'schema.json');
  const outFile = join(home.root, 'answer.json');
  await writePrivate(schemaFile, JSON.stringify(z.toJSONSchema(request.schema)));
  const images = (await writeImages(home, request.parts)).flatMap((file) => ['-i', file]);
  const modelArgs = model === 'default' ? [] : ['-m', model];
  const args = [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '-s',
    'read-only',
    '--output-schema',
    schemaFile,
    '-o',
    outFile,
    ...modelArgs,
    ...images,
    '-',
  ];
  const text = request.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n');
  const run = await runInHome(bin, home, args, `${request.system}\n\n${text}`, GENERATE_TIMEOUT_MS);
  if (run.code !== 0) return failureOf(run.stderr + run.stdout, run.timedOut);
  const answer = await readFile(outFile, 'utf8').catch(() => '');
  try {
    return { ok: true, json: JSON.parse(answer) as unknown } as const;
  } catch {
    return { ok: true, json: null } as const;
  }
}

export const codexAccount: AccountImpl = {
  spec: codexSpec,
  // The account's own default model unless the user picks one.
  defaultModel: 'default',
  models: ['default'],
  identify,
  generate,
  login: {
    command: (bin, home) => ({
      bin,
      args: ['login', '--device-auth'],
      env: home.env,
      cwd: home.root,
    }),
    urlPattern: /https:\/\/auth\.openai\.com\/codex\/device/,
    codePattern: /\b[A-Z0-9]{4}-[A-Z0-9]{5}\b/,
    needsCode: false,
  },
};
