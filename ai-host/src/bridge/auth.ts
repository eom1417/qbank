import * as Effect from 'effect/Effect';

import { ProviderAuthService } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderAuthService.ts';
import type { CallContext } from './types.ts';

type Auth = ProviderAuthService['Service'];

/**
 * Sign-in for every driver (INTEGRATION_GUIDE §7.1): ChatGPT for Codex, Google for Antigravity,
 * API-key and ACP flows. A flow belongs to the QBank session that started it.
 */
export const authHandlers = {
  'provider.auth.start': Effect.fnUntraced(function* (
    input: Parameters<Auth['start']>[0],
    context: CallContext,
  ) {
    return yield* (yield* ProviderAuthService).start(input, context.ownerSessionId);
  }),
  'provider.auth.respond': Effect.fnUntraced(function* (
    input: Parameters<Auth['respond']>[0],
    context: CallContext,
  ) {
    return yield* (yield* ProviderAuthService).respond(input, context.ownerSessionId);
  }),
  'provider.auth.complete': Effect.fnUntraced(function* (
    input: Parameters<Auth['complete']>[0],
    context: CallContext,
  ) {
    return yield* (yield* ProviderAuthService).complete(input, context.ownerSessionId);
  }),
  'provider.auth.cancel': Effect.fnUntraced(function* (
    input: Parameters<Auth['cancel']>[0],
    context: CallContext,
  ) {
    return yield* (yield* ProviderAuthService).cancel(input, context.ownerSessionId);
  }),
  'provider.auth.logout': Effect.fnUntraced(function* (input: Parameters<Auth['logout']>[0]) {
    return yield* (yield* ProviderAuthService).logout(input);
  }),
  'provider.chatgpt.reconnect-profile': Effect.fnUntraced(function* (
    input: Parameters<Auth['reconnectProfile']>[0],
  ) {
    return yield* (yield* ProviderAuthService).reconnectProfile(input);
  }),
  'provider.chatgpt.import-profile': Effect.fnUntraced(function* (
    input: Parameters<Auth['importProfile']>[0],
  ) {
    return yield* (yield* ProviderAuthService).importProfile(input);
  }),
};

/** The live state of one sign-in flow, for the client that owns it. */
export const authSubscribe = Effect.fnUntraced(function* (
  input: Parameters<Auth['subscribe']>[0],
  context: CallContext,
) {
  return (yield* ProviderAuthService).subscribe(input, context.ownerSessionId);
});
