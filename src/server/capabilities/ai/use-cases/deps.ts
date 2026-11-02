import type { Clock } from '../../../platform/clock.js';
import type { SecretBox } from '../../../platform/crypto/secret-box.js';
import type { ProviderRepository } from '../adapters/provider-repository.js';
import type { OpenProvider } from '../adapters/provider-factory.js';
import type { AiSettingsRepository } from '../adapters/settings-repository.js';

export interface AiDeps {
  providers: ProviderRepository;
  settings: AiSettingsRepository;
  openProvider: OpenProvider;
  secretBox: SecretBox;
  /** SSRF guard for user-supplied provider URLs. */
  isAllowedUrl(url: string): Promise<boolean>;
  /** The operator's local OpenAI-compatible server, if one is configured. */
  localUrl: string | null;
  clock: Clock;
  newId: () => string;
}
