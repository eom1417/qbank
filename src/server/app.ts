import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAi } from './capabilities/ai/index.js';
import { createIdentity, type RequireActor } from './capabilities/identity/index.js';
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

/**
 * The study content: banks, their questions, the user's AI, and imports. Each capability gets
 * only the others' public interfaces.
 */
function registerContent(
  app: FastifyInstance,
  { config, db, clock }: AppDeps,
  requireActor: RequireActor,
) {
  const library = createLibrary({ db, clock, requireActor: requireActor });
  library.register(app);
  const questions = createQuestions({
    db,
    clock,
    requireActor: requireActor,
    chaptersOf: library.chaptersOf,
    tagsOf: library.tagsOf,
  });
  questions.register(app);
  const ai = createAi({
    db,
    clock,
    secretBox: createSecretBox(config.masterKey),
    requireActor: requireActor,
    ...config.ai,
  });
  ai.register(app);
  const sources = createSources({
    db,
    clock,
    blobs: createDiskBlobStore(config.imports.dataDir),
    questions,
    ai,
    requireActor: requireActor,
    maxUploadBytes: config.imports.maxUploadBytes,
    maxPages: config.imports.maxPages,
    originalRetentionDays: config.imports.originalRetentionDays,
  });
  sources.register(app);
  if (config.imports.worker) {
    sources.worker.start();
    app.addHook('onClose', async () => sources.worker.stop());
  }
  app.decorate('importWorker', sources.worker);
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
  registerContent(app, { config, db, clock }, identity.requireActor);
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
