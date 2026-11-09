import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  createIdentity,
  type IdentityModule,
  type RequireActor,
} from './capabilities/identity/index.js';
import { createBackups, type Backups } from './capabilities/backup/index.js';
import { createChannels } from './capabilities/channels/index.js';
import { registerHealth } from './capabilities/health/index.js';
import { createPortability } from './capabilities/portability/index.js';
import { createLibrary } from './capabilities/library/index.js';
import { createOperator } from './capabilities/operator/index.js';
import { createProviders } from './capabilities/providers/index.js';
import { createQuestions } from './capabilities/questions/index.js';
import { createSources } from './capabilities/sources/index.js';
import { createStudy } from './capabilities/study/index.js';
import type { Clock } from './platform/clock.js';
import { createAiHosts } from './platform/ai-host/index.js';
import type { AppConfig } from './platform/config/index.js';
import type { Db } from './platform/db/index.js';
import { handleError } from './platform/http/error-handler.js';
import { requestForLog, type RotatingLog } from './platform/logging/rotating-file.js';
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
  /** The log file of a local install (M17.3); stdout only when absent. */
  log?: RotatingLog;
  /** Whether a study note's source link opens; the real web when absent (tests replace it). */
  checkLink?: (url: string) => Promise<boolean>;
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
  const aiHosts = createAiHosts(config.aiHost, config.aiHosts);
  app.addHook('onClose', aiHosts.close);
  const providers = createProviders({ aiHosts, requireActor, mode: config.mode });
  providers.register(app);
  const sources = createSources({
    log: app.log,
    workers: config.imports.workers,
    db,
    clock,
    blobs: parts.blobs,
    questions: parts.questions,
    ownsBank: parts.library.ownsBank,
    ai: providers.importAi,
    requireActor,
    maxUploadBytes: config.imports.maxUploadBytes,
    maxPages: config.imports.maxPages,
    samplePdf: config.samplePdf,
    originalRetentionDays: config.imports.originalRetentionDays,
    ...(deps.checkLink ? { checkLink: deps.checkLink } : {}),
  });
  sources.register(app);
  if (config.imports.worker) {
    sources.worker.start();
    app.addHook('onClose', async () => sources.worker.stop());
  }
  app.decorate('importWorker', sources.worker);
  return { providers, sources, aiConfigured: aiHosts.configured };
}

/** Study, then export, restore and deletion across everything (M9–M13). */
function registerContent(app: FastifyInstance, deps: ContentDeps, identity: IdentityModule) {
  const parts = registerLibrary(app, deps, identity.requireActor);
  const imports = registerImports(app, deps, identity.requireActor, parts);
  const { providers, sources } = imports;
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
  const channels = createChannels({
    db: deps.db,
    clock: deps.clock,
    newId,
    requireActor: identity.requireActor,
    questions,
    ownsBank: library.ownsBank,
    bankNameOf: async (ownerId: string, bankId: string) =>
      (await library.findBank(ownerId, bankId))?.name ?? null,
    pathOf: blobs.pathOf,
    linksEnabled: deps.config.mode !== 'local',
  });
  channels.register(app);
  app.decorate('sharing', { purge: channels.purge });
  createPortability(
    {
      library,
      sources,
      questions,
      study,
      blobs,
      forgetAi: providers.forgetAccount,
      deleteAccount: identity.deleteAccount,
      clock: deps.clock,
      maxUploadBytes: deps.config.imports.maxUploadBytes,
      mode: deps.config.mode,
      version: deps.config.version,
    },
    identity.requireActor,
  ).register(app);
  return { providers, sources, aiConfigured: imports.aiConfigured };
}

/** Composition root: wires platform owners and capabilities into one Fastify instance. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const { config, db, clock, pairingToken } = deps;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.cookie', 'req.headers.authorization'],
      serializers: { req: requestForLog },
      ...(deps.log ? { stream: deps.log } : {}),
    },
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
    localPeers: config.localPeers,
    publicOrigin: config.allowedOrigins[0] ?? null,
    operator: config.operator,
  });
  identity.register(app);
  const checks = deps.checkLink ? { checkLink: deps.checkLink } : {};
  const content = registerContent(app, { config, db, clock, ...checks }, identity);
  if (config.devOutbox) registerOutboxRoute(app, db);
  registerOperations(app, deps, identity, content);
  if (config.mode === 'accounts') registerOperator(app, deps, identity, content);
  app.get('/api/health', async () => ({ status: 'ok' }));
  return app;
}

/** Backups (local mode) and system health, over what the content capabilities expose (M17). */
function registerOperations(
  app: FastifyInstance,
  deps: AppDeps,
  identity: IdentityModule,
  content: ReturnType<typeof registerContent>,
) {
  const { config, db, clock } = deps;
  const backups = createBackups({ db, clock, dataDir: config.imports.dataDir });
  if (config.mode === 'local') backups.register(app, identity.requireActor);
  app.decorate('backups', backups);
  const health = {
    clock,
    dataDir: config.imports.dataDir,
    ai: content.providers.client,
    aiSetUp: content.providers.isSetUp,
    aiConfigured: content.aiConfigured,
    latestBackup: config.mode === 'local' ? backups.latest : null,
    lastFailure: content.sources.lastFailure,
    logFile: deps.log?.file ?? null,
  };
  registerHealth(app, health, identity.requireActor);
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Runs queued imports now (tests drive the worker through this). */
    importWorker: { drain(): Promise<number> };
    /** The daily backup (local mode): main.ts runs it on a timer, tests call it directly. */
    backups: Backups;
    /** Governed sharing's retention purge (DEC-39): main.ts runs it hourly. */
    sharing: { purge(now: Date): Promise<number> };
  }
}

/** The operator's console (M31, DEC-40): accounts mode only; a local install has no operator. */
function registerOperator(
  app: FastifyInstance,
  { config, db, clock }: AppDeps,
  identity: IdentityModule,
  content: ReturnType<typeof registerContent>,
) {
  createOperator({
    db,
    clock,
    newId,
    version: config.version,
    requireActor: identity.requireActor,
    requireOperator: identity.requireOperator,
    contactsOf: identity.contactsOf,
    resetRequests: identity.resetRequests,
    resetLink: identity.resetLink,
    listQueue: content.sources.listQueue,
    workers: config.imports.workers,
  }).register(app);
}
