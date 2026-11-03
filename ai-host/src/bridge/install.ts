import * as Effect from 'effect/Effect';

import { makeProviderInstallation } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/providerInstallation.ts';

type Installation = Effect.Success<ReturnType<typeof makeProviderInstallation>>;

/** Kit-managed installs (Codex, Antigravity): start, follow, cancel and remove (§6). */
export function installHandlers(installation: Installation) {
  return {
    'provider.install.start': (input: Parameters<Installation['start']>[0]) =>
      installation.start(input),
    'provider.install.cancel': (input: Parameters<Installation['cancel']>[0]) =>
      installation.cancel(input),
    'provider.install.remove': (input: Parameters<Installation['remove']>[0]) =>
      installation.remove(input),
  };
}

export const installSubscribe =
  (installation: Installation) => (input: Parameters<Installation['subscribe']>[0]) =>
    Effect.succeed(installation.subscribe(input));

export { makeProviderInstallation };
export type { Installation };
