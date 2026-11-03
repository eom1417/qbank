import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  QBANK_API_HOST: z.string().default('127.0.0.1'),
  QBANK_API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  QBANK_COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  QBANK_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  QBANK_DEV_OUTBOX: z.enum(['true', 'false']).default('false'),
  QBANK_ALLOWED_ORIGINS: z.string().default(''),
  QBANK_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  QBANK_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  QBANK_MASTER_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, 'QBANK_MASTER_KEY must be 32 bytes in base64'),
  QBANK_AI_ALLOW_PRIVATE_URLS: z.enum(['true', 'false']).default('false'),
  QBANK_DATA_DIR: z.string().min(1).default('.data/app'),
  QBANK_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(2000).default(200),
  QBANK_MAX_PAGES: z.coerce.number().int().min(1).max(10000).default(1500),
  QBANK_WORKER: z.enum(['true', 'false']).default('true'),
  QBANK_ORIGINAL_RETENTION_DAYS: z.coerce.number().int().min(0).max(365).default(7),
  QBANK_CLAUDE_BIN: z.string().min(1).default('claude'),
  QBANK_CODEX_BIN: z.string().min(1).default('codex'),
  QBANK_AI_WORK_DIR: z.string().min(1).default('.data/ai-work'),
  QBANK_AI_HOST_URL: z.url({ protocol: /^http$/ }).default('http://127.0.0.1:3790'),
  QBANK_AI_HOST_TOKEN: z.string().min(32).optional(),
});

export interface AppConfig {
  databaseUrl: string;
  host: string;
  port: number;
  cookieSecure: boolean;
  /** True only when a local reverse proxy (Vite dev, nginx) sets X-Forwarded-Host. */
  trustProxy: boolean;
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
  /** Encrypts BYOK keys at rest; never logged, never sent to the browser. */
  masterKey: Buffer;
  ai: {
    /**
     * Lets users point a connection at a private or loopback host (a self-hosted compatible
     * server). Off by default: provider URLs must be public https addresses (SSRF guard).
     */
    allowPrivateUrls: boolean;
    /** The official Claude Code and Codex CLIs that run subscription-account connections. */
    claudeBin: string;
    codexBin: string;
    /** Private per-run homes for those CLIs (created 0700, removed after each run). */
    workDir: string;
    /**
     * The only variables those CLIs receive (an allowlist): never the database URL, the master
     * key, or this server's own AI credentials.
     */
    cliEnv: Record<string, string>;
  };
}

const CLI_ENV = [
  'PATH',
  'LANG',
  'LC_ALL',
  'TZ',
  'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
];

const pick = (env: NodeJS.ProcessEnv, names: readonly string[]): Record<string, string> =>
  Object.fromEntries(names.flatMap((name) => (env[name] === undefined ? [] : [[name, env[name]]])));

/** The only place that reads the process environment; fails fast on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = Env.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    host: parsed.QBANK_API_HOST,
    port: parsed.QBANK_API_PORT,
    cookieSecure: parsed.QBANK_COOKIE_SECURE === 'true',
    trustProxy: parsed.QBANK_TRUST_PROXY === 'true',
    devOutbox: parsed.QBANK_DEV_OUTBOX === 'true',
    allowedOrigins: parsed.QBANK_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    sessionTtlDays: parsed.QBANK_SESSION_TTL_DAYS,
    logLevel: parsed.QBANK_LOG_LEVEL,
    imports: {
      dataDir: parsed.QBANK_DATA_DIR,
      maxUploadBytes: parsed.QBANK_MAX_UPLOAD_MB * 1024 * 1024,
      maxPages: parsed.QBANK_MAX_PAGES,
      worker: parsed.QBANK_WORKER === 'true',
      originalRetentionDays: parsed.QBANK_ORIGINAL_RETENTION_DAYS,
    },
    aiHost: { url: parsed.QBANK_AI_HOST_URL, token: parsed.QBANK_AI_HOST_TOKEN ?? null },
    masterKey: Buffer.from(parsed.QBANK_MASTER_KEY, 'base64'),
    ai: {
      allowPrivateUrls: parsed.QBANK_AI_ALLOW_PRIVATE_URLS === 'true',
      claudeBin: parsed.QBANK_CLAUDE_BIN,
      codexBin: parsed.QBANK_CODEX_BIN,
      workDir: parsed.QBANK_AI_WORK_DIR,
      cliEnv: pick(env, CLI_ENV),
    },
  };
}

const BenchAiEnv = z.object({
  QBANK_BENCH_AI_KIND: z.enum(['openai_compatible', 'anthropic']),
  QBANK_BENCH_AI_BASE_URL: z.url({ protocol: /^https$/ }),
  QBANK_BENCH_AI_MODEL: z.string().min(1),
  QBANK_BENCH_AI_KEY: z.string().min(8),
});

/**
 * The developer's own provider for the extraction benchmark (`npm run bench:extraction -- … --ai`).
 * Never used by the app, where every user connects their own key. Null when not configured.
 */
export function loadBenchAiTarget(env: NodeJS.ProcessEnv = process.env) {
  const parsed = BenchAiEnv.safeParse(env);
  if (!parsed.success) return null;
  const { QBANK_BENCH_AI_KIND, QBANK_BENCH_AI_BASE_URL, QBANK_BENCH_AI_MODEL, QBANK_BENCH_AI_KEY } =
    parsed.data;
  return {
    kind: QBANK_BENCH_AI_KIND,
    baseUrl: QBANK_BENCH_AI_BASE_URL,
    model: QBANK_BENCH_AI_MODEL,
    apiKey: QBANK_BENCH_AI_KEY,
  };
}
