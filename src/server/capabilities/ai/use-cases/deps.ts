import type { Clock } from '../../../platform/clock.js';
import type { SecretBox } from '../../../platform/crypto/secret-box.js';
import type { ProviderRepository } from '../adapters/provider-repository.js';
import type { OpenProvider, ProviderTarget } from '../adapters/provider-factory.js';
import type { ModelListing } from '../domain/ai-provider.js';
import type { AiSettingsRepository } from '../adapters/settings-repository.js';

export interface AiDeps {
  providers: ProviderRepository;
  settings: AiSettingsRepository;
  openProvider: OpenProvider;
  secretBox: SecretBox;
  /** SSRF guard for user-supplied provider URLs. */
  isAllowedUrl(url: string): Promise<boolean>;
  /** A one-off provider for a key that is not saved (choosing a model before saving). */
  listModels(target: ProviderTarget): Promise<ModelListing>;
  clock: Clock;
  newId: () => string;
}
