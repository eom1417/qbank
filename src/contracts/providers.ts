import { z } from 'zod';

/**
 * The T3 AI Providers Kit methods the providers screens call, by their wire names (the kit's
 * `WS_METHODS`). Inputs and outputs are the kit's own schemas, checked by ai-host.
 */
const KIT_METHODS = [
  'server.refreshProviders',
  'server.updateSettings',
  'server.updateProvider',
  'provider.auth.start',
  'provider.auth.respond',
  'provider.auth.complete',
  'provider.auth.cancel',
  'provider.auth.logout',
  'provider.chatgpt.reconnect-profile',
  'provider.chatgpt.import-profile',
  'provider.consumeResetCredit',
  'server.getUsageSummary',
  'server.refreshUsageRates',
  'provider.install.start',
  'provider.install.cancel',
  'provider.install.remove',
  'server.searchAcpRegistry',
  'server.prepareAcpRegistryAgent',
  'server.uninstallAcpRegistryManagedBinary',
] as const;

/** Methods whose reply is a live stream of states (a sign-in flow, an install). */
const KIT_STREAMS = ['provider.auth.subscribe', 'provider.install.subscribe'] as const;

export const KitMethod = z.enum(KIT_METHODS);
export const KitStream = z.enum(KIT_STREAMS);
export type KitMethod = z.infer<typeof KitMethod>;
export type KitStream = z.infer<typeof KitStream>;
