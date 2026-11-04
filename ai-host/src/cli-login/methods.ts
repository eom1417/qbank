/**
 * Sign-in through each provider's official CLI, for providers the kit cannot sign in itself
 * (it asks for `codex login` / `claude auth login` in a terminal). Every method suits a browser on
 * another device: a device code, or a code pasted back. Credentials land in this host's HOME,
 * where the kit's probes read them, and the CLIs refresh them on their own.
 */
export const LOGIN_METHODS = {
  /** ChatGPT plan, device code: open a link anywhere and enter the code shown. */
  'codex.chatgpt': { provider: 'codex', argv: ['codex', 'login', '--device-auth'], input: 'none' },
  /** An OpenAI API key, read from stdin (never an argument, so never in a process list). */
  'codex.apiKey': {
    provider: 'codex',
    argv: ['codex', 'login', '--with-api-key'],
    input: 'secret',
  },
  /** Claude Pro/Max: approve in the browser, then paste the code the page shows. */
  'claude.subscription': {
    provider: 'claude',
    argv: ['claude', 'auth', 'login', '--claudeai'],
    input: 'code',
  },
  /** Anthropic Console (API billing), the same way. */
  'claude.console': {
    provider: 'claude',
    argv: ['claude', 'auth', 'login', '--console'],
    input: 'code',
  },
} as const;

export type LoginMethodId = keyof typeof LOGIN_METHODS;
export type LoginProvider = (typeof LOGIN_METHODS)[LoginMethodId]['provider'];

export const LOGOUT: Record<LoginProvider, readonly string[]> = {
  codex: ['codex', 'logout'],
  claude: ['claude', 'auth', 'logout'],
};

export const isMethod = (value: unknown): value is LoginMethodId =>
  typeof value === 'string' && Object.hasOwn(LOGIN_METHODS, value);

export const isProvider = (value: unknown): value is LoginProvider =>
  value === 'codex' || value === 'claude';
