import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  QBANK_API_HOST: z.string().default('127.0.0.1'),
  QBANK_API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  QBANK_COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  QBANK_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  QBANK_ALLOWED_ORIGINS: z.string().default(''),
  QBANK_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  QBANK_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
});

export interface AppConfig {
  databaseUrl: string;
  host: string;
  port: number;
  cookieSecure: boolean;
  /** True only when a local reverse proxy (Vite dev, nginx) sets X-Forwarded-Host. */
  trustProxy: boolean;
  /** Extra origins allowed to send mutating requests besides the request's own host. */
  allowedOrigins: readonly string[];
  sessionTtlDays: number;
  logLevel: z.infer<typeof Env>['QBANK_LOG_LEVEL'];
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
    allowedOrigins: parsed.QBANK_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    sessionTtlDays: parsed.QBANK_SESSION_TTL_DAYS,
    logLevel: parsed.QBANK_LOG_LEVEL,
  };
}
