import { join } from 'node:path';
import { z } from 'zod';
import type { StructuredRequest } from '../../domain/ai-provider.js';
import { toAnthropicContent } from '../anthropic.js';
import { readJson, writePrivate, type AccountHome, type AccountSpec } from './account-home.js';
import type { CliResult } from './cli-process.js';
import {
  GENERATE_TIMEOUT_MS,
  runInHome,
  type AccountImpl,
  type CallOutcome,
  type Identity,
} from './account-ops.js';

/** The two entries of the CLI's credentials file that make one Claude subscription login. */
const CREDENTIAL_KEYS = ['claudeAiOauth', 'organizationUuid'] as const;

const Stored = z.object({
  credentials: z.record(z.string(), z.unknown()),
  oauthAccount: z.unknown().optional(),
});

/** Claude Code keeps its login in `.credentials.json` and the account in `.claude.json`. */
const claudeSpec: AccountSpec = {
  provider: 'claude',
  homeName: '.claude',
  envFor: (_root, home) => ({ CLAUDE_CONFIG_DIR: home }),
  async write(home, credential) {
    const stored = Stored.parse(JSON.parse(credential));
    await writePrivate(join(home, '.credentials.json'), JSON.stringify(stored.credentials));
    const config = { oauthAccount: stored.oauthAccount, hasCompletedOnboarding: true };
    await writePrivate(join(home, '.claude.json'), JSON.stringify(config));
  },
  async read(home) {
    const credentials = await readJson(join(home, '.credentials.json'));
    if (!credentials?.['claudeAiOauth']) return null;
    const kept = Object.fromEntries(
      CREDENTIAL_KEYS.filter((key) => key in credentials).map((key) => [key, credentials[key]]),
    );
    const config = await readJson(join(home, '.claude.json'));
    return JSON.stringify({ credentials: kept, oauthAccount: config?.['oauthAccount'] });
  },
};

const Status = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  email: z.string().nullish(),
  subscriptionType: z.string().nullish(),
});

/** `claude auth status --json`: a subscription login (`claude.ai`), not an API key. */
async function identify(bin: string, home: AccountHome): Promise<Identity | null> {
  const result = await runInHome(bin, home, ['auth', 'status', '--json']);
  const status = Status.safeParse(parseJsonLine(result.stdout));
  if (!status.success || !status.data.loggedIn || status.data.authMethod !== 'claude.ai')
    return null;
  return { email: status.data.email ?? null, plan: status.data.subscriptionType ?? null };
}

function parseJsonLine(text: string): unknown {
  const lines = text.trim().split('\n').reverse();
  for (const line of lines) {
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  return null;
}

const Result = z.object({
  type: z.literal('result'),
  is_error: z.boolean().optional(),
  api_error_status: z.number().nullish(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
});

/** Why the CLI reported an error: the API status it saw, or its message. */
function failureOf(status: number | null | undefined, text: string | undefined): CallOutcome {
  if (status === 401 || status === 403) return { ok: false, failure: 'invalid_key' };
  if (status === 429 || /limit/i.test(text ?? '')) return { ok: false, failure: 'rate_limited' };
  return { ok: false, failure: 'unexpected' };
}

/** Maps the CLI's final `result` event to an outcome the AI layer understands. */
function outcomeOf(run: CliResult): CallOutcome {
  if (run.timedOut || run.code === null) return { ok: false, failure: 'unreachable' };
  const result = Result.safeParse(parseJsonLine(run.stdout));
  if (!result.success) {
    return { ok: false, failure: /log ?in|auth/i.test(run.stderr) ? 'invalid_key' : 'unexpected' };
  }
  const { is_error, api_error_status, result: text, structured_output } = result.data;
  if (is_error) return failureOf(api_error_status, text);
  return { ok: true, json: structured_output ?? null };
}

/**
 * One structured request through the official Claude Code CLI: no tools, no saved session,
 * our own short system prompt (instead of Claude Code's), JSON constrained by the schema.
 */
async function generate<T>(
  bin: string,
  home: AccountHome,
  model: string,
  request: StructuredRequest<T>,
) {
  const args = [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    JSON.stringify(z.toJSONSchema(request.schema)),
    '--model',
    model,
    '--tools',
    '',
    '--no-session-persistence',
    '--system-prompt',
    request.system,
  ];
  const message = {
    type: 'user',
    message: { role: 'user', content: toAnthropicContent(request.parts) },
  };
  const run = await runInHome(bin, home, args, `${JSON.stringify(message)}\n`, GENERATE_TIMEOUT_MS);
  return outcomeOf(run);
}

/** Models the CLI accepts by alias; the user may also type a full model id. */
const CLAUDE_MODELS = ['sonnet', 'opus', 'haiku'];

export const claudeAccount: AccountImpl = {
  spec: claudeSpec,
  defaultModel: 'sonnet',
  models: CLAUDE_MODELS,
  identify,
  generate,
  login: {
    // The CLI wants a terminal: `script` gives it one and passes the pasted code through.
    command: (bin, home) => ({
      bin: 'script',
      args: [
        '-q',
        '-e',
        '-f',
        '-c',
        `stty cols 4000 2>/dev/null; exec "${bin}" auth login --claudeai`,
        '/dev/null',
      ],
      env: home.env,
      cwd: home.root,
    }),
    urlPattern: /https:\/\/claude\.com\/cai\/oauth\/authorize\?[^\s"'<>]+/,
    codePattern: null,
    needsCode: true,
  },
};
