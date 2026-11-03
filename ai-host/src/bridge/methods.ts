import { acpHandlers } from './acp.ts';
import { authHandlers, authSubscribe } from './auth.ts';
import { installHandlers, installSubscribe, type Installation } from './install.ts';
import { refreshProviders, updateProvider, updateSettings } from './providers.ts';
import type { StreamOpener, UnaryHandler } from './types.ts';
import { usageHandlers } from './usage.ts';

/**
 * Every provider method T3's transport exposes (ws-provider-handlers.excerpt.ts), by its wire
 * name, each calling one kit service. Thread, project and session methods have no use here.
 */
export function unaryMethods(installation: Installation): Readonly<Record<string, UnaryHandler>> {
  return {
    'server.refreshProviders': refreshProviders,
    'server.updateSettings': updateSettings,
    'server.updateProvider': updateProvider,
    ...authHandlers,
    ...usageHandlers,
    ...installHandlers(installation),
    ...acpHandlers,
  };
}

/** Methods whose reply is a live stream (sent to the browser as server-sent events). */
export function streamMethods(installation: Installation): Readonly<Record<string, StreamOpener>> {
  return {
    'provider.auth.subscribe': authSubscribe,
    'provider.install.subscribe': installSubscribe(installation),
  };
}
