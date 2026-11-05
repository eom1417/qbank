import type { ProviderDriverKind, ProviderInstanceId, ServerProvider } from '@t3tools/contracts';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';

import { ProviderMaintenanceRunner } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/providerMaintenanceRunner.ts';
import { ProviderRegistry } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderRegistry.ts';
import { updatesDue } from './update-policy.ts';

const RECHECK_EVERY = Duration.hours(6);

/**
 * Updates every CLI the kit reports as behind or too old for a model, with the kit's own
 * maintenance runner (it refreshes the instance and its models afterwards). Each release is
 * tried once; a failure is logged and never stops the host.
 */
const updateDue = (tried: Set<string>) =>
  Effect.fnUntraced(function* (providers: ReadonlyArray<ServerProvider>) {
    const runner = yield* ProviderMaintenanceRunner;
    for (const due of updatesDue(providers)) {
      if (tried.has(due.key)) continue;
      tried.add(due.key);
      yield* Effect.logInfo(`ai-host: updating the ${due.driver} CLI`);
      yield* runner
        .updateProvider({
          provider: due.driver as ProviderDriverKind,
          instanceId: due.instanceId as ProviderInstanceId,
        })
        .pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning(`ai-host: ${due.driver} CLI update failed`, cause),
          ),
        );
    }
  });

/**
 * Keeps provider CLIs current on its own. The kit learns of a newer release in the background
 * after each refresh and publishes the change; every change is checked, and a refresh every six
 * hours finds new releases.
 */
export const autoUpdateClis = Effect.gen(function* () {
  const registry = yield* ProviderRegistry;
  const check = updateDue(new Set());
  yield* check(yield* registry.getProviders);
  yield* registry.streamChanges.pipe(Stream.runForEach(check), Effect.forkChild);
  yield* registry.refresh().pipe(
    Effect.catchCause((cause) => Effect.logWarning('ai-host: provider refresh failed', cause)),
    Effect.repeat(Schedule.spaced(RECHECK_EVERY)),
  );
});
