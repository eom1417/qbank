import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import type { ImportAi } from '../providers/index.js';
import { createSessionRepository } from './adapters/session-repository.js';
import { registerStudyRoutes } from './http/routes.js';
import { resultsReport } from './use-cases/report.js';
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
    /** The sessions that asked these questions, before deleting them (FR-19-005). */
    sessionsTouching: deps.sessions.sessionsTouching,
    /** Removes these questions' answers from every session (DEC-20 assumed). */
    forgetQuestions: deps.sessions.forgetQuestions,
    /** A readable results report for personal use (FR-18-002, FR-16-011). */
    resultsReport: (
      ownerId: string,
      filter: { bankId?: string | undefined; from: Date; to: Date },
    ) => resultsReport(deps, ownerId, filter),
    register: (app: FastifyInstance) => registerStudyRoutes(app, deps, settings.requireActor),
  };
}
