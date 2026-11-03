import type { ProviderResponse } from '../../../../contracts/ai.js';
import { isApiKind, type ProviderConnection } from '../domain/provider.js';

export const toReadiness = (connection: ProviderConnection) => ({
  status: connection.readinessStatus,
  checkedAt: connection.readinessCheckedAt?.toISOString() ?? null,
});

/** The sealed key never leaves the server: only a short hint is shown (FR-08-009, FR-20-002). */
export const toProviderResponse = (connection: ProviderConnection): ProviderResponse => ({
  id: connection.id,
  kind: connection.kind,
  label: connection.label,
  baseUrl: connection.baseUrl,
  account: isApiKind(connection.kind)
    ? null
    : { email: connection.accountEmail, plan: connection.accountPlan },
  model: connection.model,
  keyHint:
    connection.keyCiphertext && isApiKind(connection.kind)
      ? `••••${connection.keyHint ?? ''}`
      : null,
  isDefault: connection.isDefault,
  inputPrice: connection.inputPrice,
  outputPrice: connection.outputPrice,
  readiness: toReadiness(connection),
});
