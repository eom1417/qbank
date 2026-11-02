import type { SecretBox } from '../../../platform/crypto/secret-box.js';
import type { AiProvider } from '../domain/ai-provider.js';
import { keyContext, type ProviderConnection } from '../domain/provider.js';
import { isAllowedEndpoint } from './endpoint-guard.js';
import { createOpenAiCompatibleProvider } from './openai-compatible.js';
import { createRecordedProvider } from './recorded-provider.js';

export interface ProviderFactorySettings {
  secretBox: SecretBox;
  localUrl: string | null;
  allowPrivateUrls: boolean;
}

export type OpenProvider = (connection: ProviderConnection) => AiProvider;

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
    const baseUrl = connection.kind === 'local' ? settings.localUrl : connection.baseUrl;
    if (!baseUrl) return createRecordedProvider({ readiness: 'unreachable', outputs: [] });
    // The operator's own local server is trusted; user-supplied URLs pass the SSRF guard.
    const isAllowed =
      connection.kind === 'local'
        ? async () => true
        : (url: string) => isAllowedEndpoint(url, settings.allowPrivateUrls);
    return createOpenAiCompatibleProvider({ baseUrl, apiKey, model: connection.model, isAllowed });
  };
}
