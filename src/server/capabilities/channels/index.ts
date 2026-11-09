import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { createAttemptRepository } from './adapters/attempt-repository.js';
import { createChannelRepository } from './adapters/channel-repository.js';
import { channelNumbers } from './adapters/channel-stats.js';
import { createLedger } from './adapters/ledger.js';
import { createShareQueries } from './adapters/share-queries.js';
import { registerAgentRoutes } from './http/agent-routes.js';
import { registerOwnerRoutes } from './http/owner-routes.js';
import { registerResultsRoutes } from './http/results-routes.js';
import { registerShareRoutes } from './http/share-routes.js';
import { registerTakeRoutes } from './http/take-routes.js';
import type { ChannelsDeps } from './use-cases/deps.js';
import { purgeExpired } from './use-cases/purge.js';

interface ChannelsSettings {
  db: Db;
  clock: Clock;
  newId(): string;
  requireActor: RequireActor;
  questions: ChannelsDeps['questions'];
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  bankNameOf(ownerId: string, bankId: string): Promise<string | null>;
  pathOf(blobKey: string): string;
  linksEnabled: boolean;
}

/**
 * Governed sharing (M23 channels, M30 shares; DEC-36, DEC-39): a bank's ready questions leave it
 * only through a share whose one policy the gate enforces for every transport: batches for an
 * outside agent holding the share's key, or exam/practice links for people. Its records are its own: study never reads
 * them and they never touch study.
 */
export function createChannels(settings: ChannelsSettings) {
  const deps: ChannelsDeps = {
    channels: createChannelRepository(settings.db),
    shares: createShareQueries(settings.db),
    attempts: createAttemptRepository(settings.db),
    ledger: createLedger(settings.db, { newId: settings.newId, now: () => settings.clock.now() }),
    linksEnabled: settings.linksEnabled,
    numbers: (channelId, cycle) => channelNumbers(settings.db, channelId, cycle),
    questions: settings.questions,
    ownsBank: settings.ownsBank,
    bankNameOf: settings.bankNameOf,
    pathOf: settings.pathOf,
    clock: settings.clock,
    newId: settings.newId,
  };
  return {
    register(app: FastifyInstance) {
      registerShareRoutes(app, deps, settings.requireActor);
      registerOwnerRoutes(app, deps, settings.requireActor);
      registerAgentRoutes(app, deps);
      registerTakeRoutes(app, deps);
      registerResultsRoutes(app, deps, settings.requireActor);
    },
    /** Deletes records older than each share's retention (DEC-39); run daily by the server. */
    purge: (now: Date) => purgeExpired(deps, now),
  };
}
