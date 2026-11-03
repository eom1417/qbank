const UNIQUE_VIOLATION = '23505';

/** True when Postgres rejected a write because a unique constraint already holds the value. */
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;

const FOREIGN_KEY_VIOLATION = '23503';

/** True when a write referenced a row that does not exist for this owner (e.g. a foreign bank). */
export const isForeignKeyViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === FOREIGN_KEY_VIOLATION;
