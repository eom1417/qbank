import { Alert, Card, MutedText, Title } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { AddProviderCard } from './AddProviderCard.js';
import { AiAboutCard } from './AiAboutCard.js';
import { AiLimitsCard } from './AiLimitsCard.js';
import { fetchProviders } from './api.js';
import { ProviderItem } from './ProviderItem.js';

/** AI keys and providers (UI-24): connections, readiness, limits and what is sent where. */
export function AiSettings() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchProviders);
  const providers = state.status === 'ready' ? state.data.providers : [];
  return (
    <>
      <Card>
        <Title>{t('ai.title')}</Title>
        <MutedText>{t('ai.intro')}</MutedText>
        {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
        {state.status === 'ready' && providers.length === 0 && (
          <MutedText>{t('ai.providers.empty')}</MutedText>
        )}
        {providers.length > 0 && (
          <ul className="qb-list" aria-label={t('ai.providers.title')}>
            {providers.map((provider) => (
              <li key={provider.id} className="qb-list__item">
                <ProviderItem provider={provider} onChange={reload} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {state.status === 'ready' && (
        <AddProviderCard localAvailable={state.data.local.available} onAdded={reload} />
      )}
      {state.status === 'ready' && <AiAboutCard hasProvider={providers.length > 0} />}
      <AiLimitsCard />
    </>
  );
}
