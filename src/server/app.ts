import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  createIdentity,
  type IdentityModule,
  type RequireActor,
} from './capabilities/identity/index.js';
import { createBackups, type Backups } from './capabilities/backup/index.js';
import { createPortability } from './capabilities/portability/index.js';
import { createLibrary } from './capabilities/library/index.js';
import { createProviders } from './capabilities/providers/index.js';
import { createQuestions } from './capabilities/questions/index.js';
import { createSources } from './capabilities/sources/index.js';
import { createStudy } from './capabilities/study/index.js';
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

type ContentDeps = Omit<AppDeps, 'pairingToken'>;

/** The library and the questions in it; each capability gets the others' public interfaces. */
function registerLibrary(
  app: FastifyInstance,
  { config, db, clock }: ContentDeps,
  requireActor: RequireActor,
) {
  const library = createLibrary({ db, clock, requireActor });
  library.register(app);
  const blobs = createDiskBlobStore(config.imports.dataDir);
  const questions = createQuestions({
    db,
    clock,
    requireActor,
    chaptersOf: library.chaptersOf,
    tagsOf: library.tagsOf,
    ownsBank: library.ownsBank,
    deleteBlob: (key) => blobs.remove(key),
  });
  questions.register(app);
  return { library, blobs, questions };
}

/** Imports through the user's AI (the providers kit), and the worker that runs them. */
function registerImports(
  app: FastifyInstance,
  deps: ContentDeps,
  requireActor: RequireActor,
  parts: ReturnType<typeof registerLibrary>,
) {
  const { config, db, clock } = deps;
  const providers = createProviders({
    aiHost: config.aiHost,
    requireActor,
    manage: config.mode === 'local',
  });
  providers.register(app);
  const sources = createSources({
    db,
    clock,
    blobs: parts.blobs,
    questions: parts.questions,
    ownsBank: parts.library.ownsBank,
    ai: providers.importAi,
    requireActor,
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
  return { providers, sources };
}

/** Study, then export, restore and deletion across everything (M9–M13). */
function registerContent(app: FastifyInstance, deps: ContentDeps, identity: IdentityModule) {
  const parts = registerLibrary(app, deps, identity.requireActor);
  const { providers, sources } = registerImports(app, deps, identity.requireActor, parts);
  const { library, questions, blobs } = parts;
  const study = createStudy({
    db: deps.db,
    clock: deps.clock,
    requireActor: identity.requireActor,
    questions,
    ownsBank: library.ownsBank,
    bankIdsOf: library.bankIdsOf,
    ai: providers.importAi,
  });
  study.register(app);
  createPortability(
    {
      library,
      sources,
      questions,
      study,
      blobs,
      deleteAccount: identity.deleteAccount,
      clock: deps.clock,
      maxUploadBytes: deps.config.imports.maxUploadBytes,
      mode: deps.config.mode,
    },
    identity.requireActor,
  ).register(app);
}

/** Composition root: wires platform owners and capabilities into one Fastify instance. */
export function buildApp({ config, db, clock, pairingToken }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization'] },
    bodyLimit: 1024 * 1024,
    // Only a proxy on this computer (the dev server) may name the visitor's address.
    trustProxy: config.trustProxy ? ['127.0.0.1', '::1'] : false,
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
    dataDir: config.imports.dataDir,
    requirePairingCode: config.requirePairingCode,
    publicOrigin: config.allowedOrigins[0] ?? null,
  });
  identity.register(app);
  registerContent(app, { config, db, clock }, identity);
  if (config.devOutbox) registerOutboxRoute(app, db);
  const backups = createBackups({ db, clock, dataDir: config.imports.dataDir });
  if (config.mode === 'local') backups.register(app, identity.requireActor);
  app.decorate('backups', backups);
  app.get('/api/health', async () => ({ status: 'ok' }));
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Runs queued imports now (tests drive the worker through this). */
    importWorker: { drain(): Promise<number> };
    /** The daily backup (local mode): main.ts runs it on a timer, tests call it directly. */
    backups: Backups;
  }
}
