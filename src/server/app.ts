import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAi } from './capabilities/ai/index.js';
import { createIdentity } from './capabilities/identity/index.js';
import { createLibrary } from './capabilities/library/index.js';
import { createQuestions } from './capabilities/questions/index.js';
import { createSources } from './capabilities/sources/index.js';
import type { Clock } from './platform/clock.js';
import type { AppConfig } from './platform/config/index.js';
import { createSecretBox } from './platform/crypto/secret-box.js';
import type { Db } from './platform/db/index.js';
import { handleError, handleNotFound } from './platform/http/error-handler.js';
import { createOriginGuard } from './platform/http/origin-guard.js';
import { newId } from './platform/ids.js';
import { createDiskBlobStore } from './platform/storage/blob-store.js';
import { createOutboxMailer, registerOutboxRoute } from './platform/mail/index.js';

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
    mailer: createOutboxMailer(db, newId),
    sessionTtlDays: config.sessionTtlDays,
    cookieSecure: config.cookieSecure,
  });
  identity.register(app);
  createLibrary({ db, clock, requireActor: identity.requireActor }).register(app);
  const ai = createAi({
    db,
    clock,
    secretBox: createSecretBox(config.masterKey),
    requireActor: identity.requireActor,
    ...config.ai,
  });
  ai.register(app);
  const sources = createSources({
    db,
    clock,
    blobs: createDiskBlobStore(config.imports.dataDir),
    questions: createQuestions({ db }),
    ai,
    requireActor: identity.requireActor,
    maxUploadBytes: config.imports.maxUploadBytes,
    maxPages: config.imports.maxPages,
  });
  sources.register(app);
  if (config.imports.worker) {
    sources.worker.start();
    app.addHook('onClose', async () => sources.worker.stop());
  }
  app.decorate('importWorker', sources.worker);
  if (config.devOutbox) registerOutboxRoute(app, db);
  app.get('/api/health', async () => ({ status: 'ok' }));
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Runs queued imports now (tests drive the worker through this). */
    importWorker: { drain(): Promise<number> };
  }
}
