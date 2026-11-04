import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import type { ImportAi } from '../providers/index.js';
import { createSessionRepository } from './adapters/session-repository.js';
import { registerStudyRoutes } from './http/routes.js';
import type { StudyDeps } from './use-cases/deps.js';

interface StudySettings {
  db: Db;
  clock: Clock;
  requireActor: RequireActor;
  questions: StudyDeps['questions'];
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  bankIdsOf(ownerId: string): Promise<string[]>;
  ai: ImportAi;
  /** The order of a session's questions; tests may fix it. */
  random?: () => number;
}

/** A uniform number in [0, 1) from the system's secure source. */
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Study sessions (M9 Tutor; M10 exams build on the same sessions and snapshots). */
export function createStudy(settings: StudySettings) {
  const deps = {
    sessions: createSessionRepository(settings.db),
    questions: settings.questions,
    ownsBank: settings.ownsBank,
    bankIdsOf: settings.bankIdsOf,
    ai: settings.ai,
    clock: settings.clock,
    newId,
    random: settings.random ?? secureRandom,
  };
  return {
    register: (app: FastifyInstance) => registerStudyRoutes(app, deps, settings.requireActor),
  };
}
