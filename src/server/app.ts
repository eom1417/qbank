import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { createIdentity, type RequireActor } from './capabilities/identity/index.js';
import { createLibrary } from './capabilities/library/index.js';
import { createProviders } from './capabilities/providers/index.js';
import { createQuestions } from './capabilities/questions/index.js';
import { createSources } from './capabilities/sources/index.js';
import type { Clock } from './platform/clock.js';
import type { AppConfig } from './platform/config/index.js';
import type { Db } from './platform/db/index.js';
import { handleError } from './platform/http/error-handler.js';
import { createOriginGuard } from './platform/http/origin-guard.js';
import { registerWebApp } from './platform/http/web-app.js';
import { newId } from './platform/ids.js';
import { createDiskBlobStore } from './platform/storage/blob-store.js';
import { createOutboxMailer, registerOutboxRoute } from './platform/mail/index.js';

export interface AppDeps {
  config: AppConfig;
  db: Db;
  clock: Clock;
  /** Local mode: the install's pairing code (identity `loadPairingToken`). Null in accounts mode. */
  pairingToken: string | null;
}

/**
 * The study content: banks, their questions, the user's AI (the providers kit), and imports. Each capability gets
 * only the others' public interfaces.
 */
function registerContent(
  app: FastifyInstance,
  { config, db, clock }: Omit<AppDeps, 'pairingToken'>,
  requireActor: RequireActor,
) {
  const library = createLibrary({ db, clock, requireActor: requireActor });
  library.register(app);
  const blobs = createDiskBlobStore(config.imports.dataDir);
  const questions = createQuestions({
    db,
    clock,
    requireActor: requireActor,
    chaptersOf: library.chaptersOf,
    tagsOf: library.tagsOf,
    ownsBank: library.ownsBank,
    deleteBlob: (key) => blobs.remove(key),
  });
  questions.register(app);
  const providers = createProviders({ aiHost: config.aiHost, requireActor });
  providers.register(app);
  const sources = createSources({
    db,
    clock,
    blobs,
    questions,
    ai: providers.importAi,
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
export function buildApp({ config, db, clock, pairingToken }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization'] },
    bodyLimit: 1024 * 1024,
    trustProxy: config.trustProxy,
  });
  app.register(cookie);
  app.addHook('onRequest', createOriginGuard(config.allowedOrigins));
  app.setErrorHandler(handleError);
  registerWebApp(app, config.webDir);

  const identity = createIdentity({
    db,
    clock,
    mailer: createOutboxMailer(db, newId),
    sessionTtlDays: config.sessionTtlDays,
    cookieSecure: config.cookieSecure,
    pairingToken,
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
