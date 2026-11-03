import type { ApiProviderKind } from '../../../../contracts/ai.js';
import type { SecretBox } from '../../../platform/crypto/secret-box.js';
import type { AiProvider } from '../domain/ai-provider.js';
import { isApiKind, keyContext, type ProviderConnection } from '../domain/provider.js';
import {
  accountProviderOf,
  createAccountProvider,
  createExclusive,
  opsFor,
  type AccountCliSettings,
} from './accounts/index.js';
import { createAnthropicProvider } from './anthropic.js';
import { isAllowedEndpoint } from './endpoint-guard.js';
import { createOpenAiCompatibleProvider } from './openai-compatible.js';
import { createRecordedProvider } from './recorded-provider.js';

export interface ProviderFactorySettings {
  secretBox: SecretBox;
  allowPrivateUrls: boolean;
  accounts: AccountCliSettings;
  /** Seals and stores a subscription login the CLI refreshed during a run. */
  saveCredential(connection: ProviderConnection, credential: string): Promise<void>;
}

export interface ProviderTarget {
  kind: ApiProviderKind;
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

function accountProvider(
  settings: ProviderFactorySettings,
  connection: ProviderConnection,
  credential: string,
  exclusive: ReturnType<typeof createExclusive>,
): AiProvider {
  const provider = accountProviderOf(connection.kind);
  if (!provider) return createRecordedProvider({ readiness: 'unexpected', outputs: [] });
  return createAccountProvider({
    ops: opsFor(settings.accounts, provider),
    home: settings.accounts,
    credential,
    model: connection.model,
    saveCredential: (refreshed) => settings.saveCredential(connection, refreshed),
    exclusive: (work) => exclusive(connection.id, work),
  });
}

/**
 * Turns a stored connection into a live provider. This is the only place a key or a
 * subscription login is decrypted, and only for the call being made; it is never logged or
 * returned (BLUEPRINT §6).
 */
export function createProviderFactory(settings: ProviderFactorySettings): OpenProvider {
  const exclusive = createExclusive();
  return (connection) => {
    const secret = connection.keyCiphertext
      ? settings.secretBox.open(connection.keyCiphertext, keyContext(connection))
      : null;
    // A secret that no longer opens (tampered or moved between rows) is treated as invalid.
    if (connection.keyCiphertext && secret === null) {
      return createRecordedProvider({ readiness: 'invalid_key', outputs: [] });
    }
    if (!isApiKind(connection.kind)) {
      if (!secret) return createRecordedProvider({ readiness: 'invalid_key', outputs: [] });
      return accountProvider(settings, connection, secret, exclusive);
    }
    const { model } = connection;
    const target = {
      kind: connection.kind,
      baseUrl: connection.baseUrl ?? '',
      apiKey: secret,
      model,
    };
    return providerFor(target, settings.allowPrivateUrls);
  };
}
