import { useState } from 'react';
import type { ModelTestResponse, ProviderView } from '../../../contracts/providers.js';
import { Button, MutedText, Row } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { testModel } from './api.js';

type TestState = 'idle' | 'busy' | ModelTestResponse['status'];

/** One model, with a real test turn: the list says what the kit offers, the test that it runs. */
function ModelRow({ provider, slug, name, isDefault }: ModelRowProps) {
  const { t } = useI18n();
  const [state, setState] = useState<TestState>('idle');
  const run = async () => {
    setState('busy');
    setState(
      await testModel({ instanceId: provider.instanceId, model: slug }).catch(
        () => 'unexpected' as const,
      ),
    );
  };
  const ready = provider.enabled && provider.auth.status === 'authenticated';
  return (
    <li className="qb-list__item">
      <Row>
        <bdi>{name ?? slug}</bdi>
        {isDefault && <MutedText>★</MutedText>}
        {ready && (
          <Button variant="ghost" busy={state === 'busy'} onClick={() => void run()}>
            {t('providers.test')}
          </Button>
        )}
        {state !== 'idle' && state !== 'busy' && (
          <MutedText>{t(`providers.test.${state}` as MessageKey)}</MutedText>
        )}
      </Row>
    </li>
  );
}

interface ModelRowProps {
  provider: ProviderView;
  slug: string;
  name: string | undefined;
  isDefault: boolean;
}

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
          <ModelRow
            key={model.slug}
            provider={provider}
            slug={model.slug}
            name={model.name}
            isDefault={model.isDefault === true}
          />
        ))}
      </ul>
    </details>
  );
}
