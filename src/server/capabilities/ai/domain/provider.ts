import type { ProviderKind, ReadinessStatus } from '../../../../contracts/ai.js';

/** One AI connection of an account. The key stays sealed: only the adapter opens it, per call. */
export interface ProviderConnection {
  id: string;
  ownerId: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  keyCiphertext: string | null;
  keyHint: string | null;
  inputPrice: number | null;
  outputPrice: number | null;
  isDefault: boolean;
  readinessStatus: ReadinessStatus;
  readinessCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Failures that calling again cannot fix until the user changes the key or the account. */
const HARD_FAILURES: ReadonlySet<ReadinessStatus> = new Set([
  'invalid_key',
  'no_permission',
  'no_quota',
]);

/** FR-08-011: a known hard failure is reported without spending another provider call. */
export const isKnownHardFailure = (status: ReadinessStatus): boolean => HARD_FAILURES.has(status);

/** "••••3f9a": enough to recognise a key, never enough to use it. Short keys show no characters. */
export const keyHint = (key: string): string => (key.length >= 16 ? key.slice(-4) : '');

/** Binds a sealed key to its row, so it cannot be opened from another account's row (FR-20-002). */
export const keyContext = (connection: Pick<ProviderConnection, 'ownerId' | 'id'>): string =>
  `ai_provider:${connection.ownerId}:${connection.id}`;
