import type { ProviderView } from '../../../contracts/providers.js';
import { MutedText } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The models this account can use, from the kit's catalog (opened on demand). */
export function ProviderModels({ provider }: { provider: ProviderView }) {
  const { t } = useI18n();
  if (provider.models.length === 0) return null;
  return (
    <details>
      <summary>
        {t('providers.models')} ({provider.models.length})
      </summary>
      <ul className="qb-list">
        {provider.models.map((model) => (
          <li key={model.slug} className="qb-list__item">
            <bdi>{model.name}</bdi>
            {model.isDefault && <MutedText>★</MutedText>}
          </li>
        ))}
      </ul>
    </details>
  );
}
