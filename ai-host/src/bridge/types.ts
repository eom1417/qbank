import type * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';
import type * as Stream from 'effect/Stream';

import type * as ProviderKit from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/providerKit/ProviderKitStandalone.ts';

/** Everything the kit provides (INTEGRATION_GUIDE §5 outputs). */
export type KitServices = Layer.Success<ReturnType<typeof ProviderKit.layer>>;

/** Who asks: QBank's session for the signed-in user; sign-in flows belong to it (§6). */
export interface CallContext {
  readonly ownerSessionId: string;
}

/** Kit failures are tagged errors (Data.TaggedError / Schema.TaggedErrorClass). */
export interface TaggedFailure {
  readonly _tag: string;
}

export type UnaryHandler = (
  payload: never,
  context: CallContext,
) => Effect.Effect<unknown, TaggedFailure, KitServices>;

export type StreamOpener = (
  payload: never,
  context: CallContext,
) => Effect.Effect<Stream.Stream<unknown, TaggedFailure>, TaggedFailure, KitServices>;
