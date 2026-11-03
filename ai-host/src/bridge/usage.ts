import { ProviderSetupError, type ProviderConsumeResetCreditInput } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';

import { ProviderInstanceRegistry } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderInstanceRegistry.ts';
import { UsageLimitSources } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/usage/UsageLimitSources.ts';
import { UsageService } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/usage/UsageService.ts';

const setupError = (instanceId: ProviderSetupError['instanceId'], detail: string) =>
  new ProviderSetupError({ instanceId, operation: 'consume-reset-credit', detail });

/** Banks a reset credit, through a usage source or the instance that owns it (ws.ts 2503-2534). */
const consumeResetCredit = Effect.fnUntraced(function* (input: ProviderConsumeResetCreditInput) {
  if ('sourceId' in input) return yield* (yield* UsageLimitSources).consumeResetCredit(input);
  const instance = yield* (yield* ProviderInstanceRegistry).getInstance(input.instanceId);
  if (instance === undefined || !instance.enabled)
    return yield* setupError(
      input.instanceId,
      instance ? 'This provider is disabled.' : 'Provider instance not found.',
    );
  if (instance.consumeResetCredit === undefined)
    return yield* setupError(input.instanceId, 'This provider does not bank reset credits.');
  const outcome = yield* instance
    .consumeResetCredit()
    .pipe(Effect.mapError((error) => setupError(input.instanceId, error.detail)));
  return { outcome };
});

/** Usage history, limits and reset credits (INTEGRATION_GUIDE §7.4). */
export const usageHandlers = {
  'provider.consumeResetCredit': consumeResetCredit,
  'server.getUsageSummary': Effect.fnUntraced(function* (
    input: Parameters<UsageService['Service']['readSummary']>[0],
  ) {
    return yield* (yield* UsageService).readSummary(input);
  }),
  'server.refreshUsageRates': Effect.fnUntraced(function* () {
    return yield* (yield* UsageService).refreshRates;
  }),
};
