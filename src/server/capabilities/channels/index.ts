import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { createChannelRepository } from './adapters/channel-repository.js';
import { channelNumbers } from './adapters/channel-stats.js';
import { registerAgentRoutes } from './http/agent-routes.js';
import { registerOwnerRoutes } from './http/owner-routes.js';
import type { ChannelsDeps } from './use-cases/deps.js';

interface ChannelsSettings {
  db: Db;
  clock: Clock;
  newId(): string;
  requireActor: RequireActor;
  questions: ChannelsDeps['questions'];
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  pathOf(blobKey: string): string;
}

/**
 * Publishing channels (M23, DEC-36): a bank's ready questions, in batches that do not repeat,
 * for an outside agent holding the channel's key. Its records are its own: study never reads
 * them and they never touch study.
 */
export function createChannels(settings: ChannelsSettings) {
  const deps: ChannelsDeps = {
    channels: createChannelRepository(settings.db),
    numbers: (channelId, cycle) => channelNumbers(settings.db, channelId, cycle),
    questions: settings.questions,
    ownsBank: settings.ownsBank,
    pathOf: settings.pathOf,
    clock: settings.clock,
    newId: settings.newId,
  };
  return {
    register(app: FastifyInstance) {
      registerOwnerRoutes(app, deps, settings.requireActor);
      registerAgentRoutes(app, deps);
    },
  };
}
