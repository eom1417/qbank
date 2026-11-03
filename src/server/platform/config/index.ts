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
  /** Encrypts BYOK keys at rest; never logged, never sent to the browser. */
  masterKey: Buffer;
  ai: {
    /**
     * Lets users point a connection at a private or loopback host (a self-hosted compatible
     * server). Off by default: provider URLs must be public https addresses (SSRF guard).
     */
    allowPrivateUrls: boolean;
  };
}

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
    masterKey: Buffer.from(parsed.QBANK_MASTER_KEY, 'base64'),
    ai: {
      allowPrivateUrls: parsed.QBANK_AI_ALLOW_PRIVATE_URLS === 'true',
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
