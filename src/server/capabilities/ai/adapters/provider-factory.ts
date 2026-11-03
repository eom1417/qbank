import type { ProviderKind } from '../../../../contracts/ai.js';
import type { SecretBox } from '../../../platform/crypto/secret-box.js';
import type { AiProvider } from '../domain/ai-provider.js';
import { keyContext, type ProviderConnection } from '../domain/provider.js';
import { createAnthropicProvider } from './anthropic.js';
import { isAllowedEndpoint } from './endpoint-guard.js';
import { createOpenAiCompatibleProvider } from './openai-compatible.js';
import { createRecordedProvider } from './recorded-provider.js';

export interface ProviderFactorySettings {
  secretBox: SecretBox;
  allowPrivateUrls: boolean;
}

export interface ProviderTarget {
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string | null;
  model: string;
}

export type OpenProvider = (connection: ProviderConnection) => AiProvider;

/** A live provider for an address and key; every call passes the SSRF guard. */
export function providerFor(target: ProviderTarget, allowPrivateUrls: boolean): AiProvider {
  const endpoint = {
    ...target,
    isAllowed: (url: string) => isAllowedEndpoint(url, allowPrivateUrls),
  };
  return target.kind === 'anthropic'
    ? createAnthropicProvider(endpoint)
    : createOpenAiCompatibleProvider(endpoint);
}

/**
 * Turns a stored connection into a live provider. This is the only place a key is decrypted,
 * and only for the call being made; it is never logged or returned (BLUEPRINT §6).
 */
export function createProviderFactory(settings: ProviderFactorySettings): OpenProvider {
  return (connection) => {
    const apiKey = connection.keyCiphertext
      ? settings.secretBox.open(connection.keyCiphertext, keyContext(connection))
      : null;
    // A key that no longer opens (tampered or moved between rows) is treated as invalid.
    if (connection.keyCiphertext && apiKey === null) {
      return createRecordedProvider({ readiness: 'invalid_key', outputs: [] });
    }
    const { kind, baseUrl, model } = connection;
    return providerFor({ kind, baseUrl, apiKey, model }, settings.allowPrivateUrls);
  };
}
