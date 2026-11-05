import { useCallback, useState } from 'react';
import { Alert, Button, Heading, MutedText, Row, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { AddProviderCard } from './AddProviderCard.js';
import { DisclosureNote } from './DisclosureNote.js';
import { ProviderAccessContext } from './access.js';
import { fetchDrivers, fetchProviderAccess, KitError, kitCall } from './api.js';
import { ProviderCard } from './ProviderCard.js';
import { useProviderState } from './use-provider-state.js';

/** A kit failure explains itself; QBank's own errors use their translated message. */
function useErrorText() {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const show = useCallback(
    (error: unknown) =>
      setText(error instanceof KitError ? error.message : t(errorMessageKey(error))),
    [t],
  );
  return { text, show };
}

/** Every AI provider of this install (the T3 AI Providers Kit, DEC-30), live. */
export function ProvidersScreen() {
  const { t } = useI18n();
  const { state } = useProviderState();
  const drivers = useQuery(fetchDrivers).state;
  const access = useQuery(fetchProviderAccess).state;
  const error = useErrorText();
  const refreshAll = useAction(async () => {
    await kitCall('server.refreshProviders', { refreshModels: true }).catch(error.show);
  });
  if (state.status === 'loading' || access.status === 'loading')
    return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  if (access.status === 'error') return <Alert tone="error">{t(access.error)}</Alert>;
  const labels = new Map(
    drivers.status === 'ready' ? drivers.data.drivers.map((d) => [d.driverKind, d.label]) : [],
  );
  return (
    <ProviderAccessContext.Provider value={access.data}>
      <Stack>
        <Row>
          <Heading>{t('providers.title')}</Heading>
          <Button variant="secondary" busy={refreshAll.busy} onClick={() => void refreshAll.run()}>
            {t('providers.refreshAll')}
          </Button>
        </Row>
        <MutedText>{t('providers.intro')}</MutedText>
        <Alert tone="info">{t('providers.withoutAi')}</Alert>
        <DisclosureNote />
        {error.text && <Alert tone="error">{error.text}</Alert>}
        {state.providers.map((provider) => (
          <ProviderCard
            key={provider.instanceId}
            provider={provider}
            label={labels.get(provider.driver) ?? provider.driver}
            config={state.instances[provider.instanceId]}
            onError={error.show}
          />
        ))}
        {!access.data.signIn && <MutedText>{t('providers.readOnly')}</MutedText>}
        {drivers.status === 'ready' && access.data.signIn && (
          <AddProviderCard drivers={drivers.data.drivers} onError={error.show} />
        )}
      </Stack>
    </ProviderAccessContext.Provider>
  );
}
