import type { QueueItem } from '../../../../contracts/operator.js';
import type { Clock } from '../../../platform/clock.js';
import type { OperatorDirectory } from '../../identity/index.js';
import type { FeedbackRepository } from '../adapters/feedback-repository.js';

/**
 * What the operator's console reaches: its own notes, identity's directory (who sent a note, and
 * reset requests with their links), and other capabilities' public functions.
 */
export interface OperatorDeps extends OperatorDirectory {
  feedback: FeedbackRepository;
  clock: Clock;
  newId: () => string;
  /** The running release, saved with each note. */
  version: string;
  /** Sources: imports running and waiting across the server (never their content). */
  listQueue(): Promise<QueueItem[]>;
  /** Imports that run at once (`config.imports.workers`). */
  workers: number;
}
