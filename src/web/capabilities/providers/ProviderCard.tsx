import type { InstanceConfig, ProviderView } from '../../../contracts/providers.js';
import { Badge, Card, MutedText, Row, Stack, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { ProviderActions } from './ProviderActions.js';
import { ProviderLimits } from './ProviderLimits.js';
import { ProviderModels } from './ProviderModels.js';
import { SignInPanel } from './SignInPanel.js';

interface CardProps {
  provider: ProviderView;
  label: string;
  config: InstanceConfig | undefined;
  onError(error: unknown): void;
}

/** Who is signed in, in the provider's own words (account, plan, email). */
function AuthLine({ provider }: { provider: ProviderView }) {
  const { t } = useI18n();
  const who = [provider.auth.label, provider.auth.email].filter(Boolean).join(' · ');
  return (
    <MutedText>
      {t(`providers.auth.${provider.auth.status}`)}
      {who && ': '}
      {who && <bdi>{who}</bdi>}
    </MutedText>
  );
}

/** One provider instance: status, sign-in, models, usage limits and every action it allows. */
export function ProviderCard({ provider, label, config, onError }: CardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Row>
          <Title>
            <bdi>{provider.displayName ?? label}</bdi>
          </Title>
          <Badge>{t(`providers.status.${provider.status}`)}</Badge>
          {provider.badgeLabel && <Badge>{provider.badgeLabel}</Badge>}
        </Row>
        <AuthLine provider={provider} />
        {provider.message && <MutedText>{provider.message}</MutedText>}
        {!provider.installed && <MutedText>{t('providers.notInstalled')}</MutedText>}
        {provider.version && (
          <MutedText>
            {t('providers.version')} <bdi>{provider.version}</bdi>
          </MutedText>
        )}
        <SignInPanel provider={provider} onError={onError} />
        <ProviderLimits provider={provider} />
        <ProviderModels provider={provider} />
        <ProviderActions provider={provider} config={config} onError={onError} />
      </Stack>
    </Card>
  );
}
