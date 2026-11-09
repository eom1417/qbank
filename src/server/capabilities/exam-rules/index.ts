/**
 * The rules every timed or graded set of questions follows, whoever asks them: the owner's own
 * study sessions and a shared exam (M30). Pure functions only; no tables, no routes.
 */
export {
  canChange,
  deadlineFor,
  isOverdue,
  secondsLeft,
  type ExamTiming,
} from './domain/timing.js';
export { isCorrect, type Snapshot } from './domain/grading.js';
export { shuffled } from './domain/shuffle.js';
