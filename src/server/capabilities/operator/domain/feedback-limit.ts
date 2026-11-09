/** Notes one account may send in a rolling hour (M31, B1): enough for a person, too few to flood. */
const FEEDBACK_PER_HOUR = 10;

const HOUR_MS = 60 * 60 * 1000;

/** Where the rolling hour that counts against the limit starts. */
export const feedbackWindowStart = (now: Date): Date => new Date(now.getTime() - HOUR_MS);

export const maySendFeedback = (sentInWindow: number): boolean => sentInWindow < FEEDBACK_PER_HOUR;
