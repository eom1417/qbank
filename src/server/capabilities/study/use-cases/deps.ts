import type { Clock } from '../../../platform/clock.js';
import type { ImportAi } from '../../providers/index.js';
import type { Questions } from '../../questions/index.js';
import type { SessionRepository } from '../adapters/session-repository.js';

/** What study needs from the rest of the app, each through its public interface. */
export interface StudyDeps {
  sessions: SessionRepository;
  questions: Pick<
    Questions,
    | 'studyPool'
    | 'marksOf'
    | 'statusCounts'
    | 'qualityBySource'
    | 'reportedQuestionIds'
    | 'searchQuestions'
  >;
  /** Whether the bank is the account's (from the library). */
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** The account's bank ids (from the library), for figures over the whole library. */
  bankIdsOf(ownerId: string): Promise<string[]>;
  /** The user's own AI, for explanations after the answer (FR-08-005). */
  ai: ImportAi;
  clock: Clock;
  newId: () => string;
  /** The session order's randomness (tests may fix it). */
  random: () => number;
}
