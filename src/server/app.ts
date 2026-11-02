import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { createIdentity } from './capabilities/identity/index.js';
import { createLibrary } from './capabilities/library/index.js';
import type { Clock } from './platform/clock.js';
import type { AppConfig } from './platform/config/index.js';
import type { Db } from './platform/db/index.js';
import { handleError, handleNotFound } from './platform/http/error-handler.js';
import { createOriginGuard } from './platform/http/origin-guard.js';

export interface AppDeps {
  config: AppConfig;
  db: Db;
  clock: Clock;
}

/** Composition root: wires platform owners and capabilities into one Fastify instance. */
export function buildApp({ config, db, clock }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization'] },
    bodyLimit: 1024 * 1024,
    trustProxy: config.trustProxy,
  });
  app.register(cookie);
  app.addHook('onRequest', createOriginGuard(config.allowedOrigins));
  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);

  const identity = createIdentity({
    db,
    clock,
    sessionTtlDays: config.sessionTtlDays,
    cookieSecure: config.cookieSecure,
  });
  identity.register(app);
  createLibrary({ db, clock, requireActor: identity.requireActor }).register(app);
  app.get('/api/health', async () => ({ status: 'ok' }));
  return app;
}
