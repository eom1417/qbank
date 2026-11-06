import { z } from 'zod';
import { AppMode } from '../../../contracts/identity.js';

const Env = z.object({
  QBANK_MODE: AppMode.default('local'),
  /** Unset in local mode: the bundled PGlite database under QBANK_DATA_DIR. */
  DATABASE_URL: z.string().min(1).optional(),
  QBANK_API_HOST: z.string().default('127.0.0.1'),
  QBANK_API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  QBANK_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  QBANK_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  /** 'true': this computer pairs with the code too (QBank reached through a TCP tunnel). */
  QBANK_REQUIRE_PAIRING_CODE: z.enum(['true', 'false']).default('false'),
  /** Addresses or CIDR ranges that also count as this computer (Docker's network, M25). */
  QBANK_LOCAL_PEERS: z.string().default(''),
  QBANK_DEV_OUTBOX: z.enum(['true', 'false']).default('false'),
  QBANK_ALLOWED_ORIGINS: z.string().default(''),
  QBANK_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(400).optional(),
  QBANK_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  QBANK_DATA_DIR: z.string().min(1).default('.data/app'),
  QBANK_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(2000).default(200),
  QBANK_MAX_PAGES: z.coerce.number().int().min(1).max(10000).default(1500),
  QBANK_WORKER: z.enum(['true', 'false']).default('true'),
  QBANK_ORIGINAL_RETENTION_DAYS: z.coerce.number().int().min(0).max(365).default(7),
  QBANK_AI_HOST_URL: z.url({ protocol: /^http$/ }).default('http://127.0.0.1:3790'),
  QBANK_AI_HOST_TOKEN: z.string().min(32).optional(),
  /** `single`: one AI host for the install. `per_account`: one per account (DEC-35). */
  QBANK_AI_HOSTS: z.enum(['single', 'per_account']).optional(),
  QBANK_AI_HOSTS_DIR: z.string().min(1).optional(),
  /** Node 24.10+ for the providers kit (scripts/setup-ai-host.sh installs it there). */
  QBANK_AI_HOST_NODE: z.string().min(1).default('/opt/node24/bin/node'),
  QBANK_AI_HOST_ENTRY: z.string().min(1).default('ai-host/src/main.ts'),
  QBANK_AI_HOSTS_MAX: z.coerce.number().int().min(1).max(1000).default(20),
  QBANK_AI_HOSTS_IDLE_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  /** How often each account's provider sign-ins are renewed while it is away (DEC-35). */
  QBANK_AI_HOSTS_REFRESH_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  /** The built web app the API serves (`npm run build`); `none` leaves it to a dev server. */
  QBANK_WEB_DIR: z.string().min(1).default('dist/web'),
});

export interface AppConfig {
  /** `local`: one owner, paired browsers, no sign-up (DEC-31). `accounts`: hosted accounts. */
  mode: AppMode;
  databaseUrl: string;
  host: string;
  port: number;
  cookieSecure: boolean;
  /** True only when a local reverse proxy (Vite dev, nginx) sets X-Forwarded-Host. */
  trustProxy: boolean;
  requirePairingCode: boolean;
  /**
   * Socket addresses that count as this computer besides loopback: Docker's network, where the
   * port is published to the host's loopback only (compose.yaml). Never a LAN range.
   */
  localPeers: readonly string[];
  /** Exposes GET /api/dev/outbox (local mail adapter). Local development and tests only. */
  devOutbox: boolean;
  /** Extra origins allowed to send mutating requests besides the request's own host. */
  allowedOrigins: readonly string[];
  sessionTtlDays: number;
  logLevel: z.infer<typeof Env>['QBANK_LOG_LEVEL'];
  imports: {
    /** Uploaded originals live here (BlobStore on local disk) until verified and deleted. */
    dataDir: string;
    maxUploadBytes: number;
    maxPages: number;
    /** Runs the import worker inside this process (off in tests, which drive it directly). */
    worker: boolean;
    /** Days an original stays after its import ends unless the user deletes it (DEC-13). */
    originalRetentionDays: number;
  };
  /**
   * The AI host (ai-host/): the vendored T3 AI Providers Kit on a loopback port. Without a token
   * the providers screens report it as unavailable.
   */
  aiHost: { url: string; token: string | null };
  /** One AI host for the install, or one per account in its own folder (DEC-35). */
  aiHosts: AiHostsConfig;
  /** Served at `/` when it holds a build; null serves the API only. */
  webDir: string | null;
}

export interface AiHostsConfig {
  mode: 'single' | 'per_account';
  /** Each account's host lives in `<dir>/<accountId>/` (its kit home and its HOME). */
  dir: string;
  node: string;
  entry: string;
  /** Hosts running at once; an idle one is stopped to make room, else `ai_host_busy`. */
  max: number;
  idleMs: number;
  /** Every account's sign-ins are renewed this often, so a long absence never lapses them. */
  refreshMs: number;
  /** The only server variables a host (and the provider tools it starts) inherits. */
  inherited: Record<string, string>;
}

/** Enough to run a program and read text; never QBank's own settings or secrets. */
const HOST_INHERITS = ['PATH', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR'] as const;

/** Accounts get their own hosts unless the install says `single` (the M22 roll-back switch). */
function aiHostsOf(parsed: z.infer<typeof Env>, env: NodeJS.ProcessEnv): AiHostsConfig {
  const inherited = HOST_INHERITS.flatMap((name) => {
    const value = env[name];
    return value === undefined ? [] : [[name, value] as const];
  });
  return {
    inherited: Object.fromEntries(inherited),
    mode: parsed.QBANK_AI_HOSTS ?? (parsed.QBANK_MODE === 'local' ? 'single' : 'per_account'),
    dir: parsed.QBANK_AI_HOSTS_DIR ?? `${parsed.QBANK_DATA_DIR}/ai-hosts`,
    node: parsed.QBANK_AI_HOST_NODE,
    entry: parsed.QBANK_AI_HOST_ENTRY,
    max: parsed.QBANK_AI_HOSTS_MAX,
    idleMs: parsed.QBANK_AI_HOSTS_IDLE_MINUTES * 60_000,
    refreshMs: parsed.QBANK_AI_HOSTS_REFRESH_HOURS * 3_600_000,
  };
}

/** A local install starts with nothing to set up: PGlite in its data directory. */
function databaseUrlOf(parsed: z.infer<typeof Env>): string {
  if (parsed.DATABASE_URL) return parsed.DATABASE_URL;
  if (parsed.QBANK_MODE === 'local') return `pglite:${parsed.QBANK_DATA_DIR}/db`;
  throw new Error('DATABASE_URL is required in accounts mode');
}

/** Local defaults: plain http on this computer or its network, and a paired browser stays paired. */
const LOCAL_DEFAULTS = { cookieSecure: 'false', sessionTtlDays: 400 } as const;
const ACCOUNTS_DEFAULTS = { cookieSecure: 'true', sessionTtlDays: 30 } as const;

/** The only place that reads the process environment; fails fast on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = Env.parse(env);
  const defaults = parsed.QBANK_MODE === 'local' ? LOCAL_DEFAULTS : ACCOUNTS_DEFAULTS;
  return {
    mode: parsed.QBANK_MODE,
    databaseUrl: databaseUrlOf(parsed),
    host: parsed.QBANK_API_HOST,
    port: parsed.QBANK_API_PORT,
    cookieSecure: (parsed.QBANK_COOKIE_SECURE ?? defaults.cookieSecure) === 'true',
    trustProxy: parsed.QBANK_TRUST_PROXY === 'true',
    requirePairingCode: parsed.QBANK_REQUIRE_PAIRING_CODE === 'true',
    localPeers: parsed.QBANK_LOCAL_PEERS.split(',')
      .map((peer) => peer.trim())
      .filter(Boolean),
    devOutbox: parsed.QBANK_DEV_OUTBOX === 'true',
    allowedOrigins: parsed.QBANK_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    sessionTtlDays: parsed.QBANK_SESSION_TTL_DAYS ?? defaults.sessionTtlDays,
    logLevel: parsed.QBANK_LOG_LEVEL,
    imports: {
      dataDir: parsed.QBANK_DATA_DIR,
      maxUploadBytes: parsed.QBANK_MAX_UPLOAD_MB * 1024 * 1024,
      maxPages: parsed.QBANK_MAX_PAGES,
      worker: parsed.QBANK_WORKER === 'true',
      originalRetentionDays: parsed.QBANK_ORIGINAL_RETENTION_DAYS,
    },
    aiHost: { url: parsed.QBANK_AI_HOST_URL, token: parsed.QBANK_AI_HOST_TOKEN ?? null },
    aiHosts: aiHostsOf(parsed, env),
    webDir: parsed.QBANK_WEB_DIR === 'none' ? null : parsed.QBANK_WEB_DIR,
  };
}

const BenchAiEnv = z.object({
  QBANK_AI_HOST_URL: z.url({ protocol: /^http$/ }).default('http://127.0.0.1:3790'),
  QBANK_AI_HOST_TOKEN: z.string().min(32),
});

/**
 * The AI host for the extraction benchmark (`npm run bench:extraction -- … --ai=<instance>`):
 * the developer's own signed-in provider instance. Null when the host is not configured.
 */
export function loadBenchAiHost(env: NodeJS.ProcessEnv = process.env) {
  const parsed = BenchAiEnv.safeParse(env);
  return parsed.success
    ? { url: parsed.data.QBANK_AI_HOST_URL, token: parsed.data.QBANK_AI_HOST_TOKEN }
    : null;
}
