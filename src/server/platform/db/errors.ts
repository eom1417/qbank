const UNIQUE_VIOLATION = '23505';

/** True when Postgres rejected a write because a unique constraint already holds the value. */
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
