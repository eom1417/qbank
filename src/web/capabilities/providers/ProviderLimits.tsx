import type { ProviderView } from '../../../contracts/providers.js';
import { Button, Meter, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { kitCall } from './api.js';

/** The subscription's usage windows (session, weekly…), when they reset, and reset credits. */
export function ProviderLimits({ provider }: { provider: ProviderView }) {
  const { t, locale } = useI18n();
  const limits = provider.usageLimits;
  const consume = useAction(async () => {
    await kitCall('provider.consumeResetCredit', { instanceId: provider.instanceId });
  });
  if (!limits || limits.windows.length === 0) return null;
  const when = (iso: string) => new Date(iso).toLocaleString(locale);
  return (
    <Stack>
      <Subtitle>{t('providers.limits')}</Subtitle>
      {limits.windows.map((window) => (
        <Stack key={window.id}>
          <MutedText>
            {window.label}: {Math.round(window.usedPercent)}%
            {window.resetsAt && ` · ${t('providers.resetsAt')} ${when(window.resetsAt)}`}
          </MutedText>
          <Meter percent={window.usedPercent} label={window.label} />
        </Stack>
      ))}
      {limits.resetCredits && limits.resetCredits.availableCount > 0 && (
        <Button variant="secondary" busy={consume.busy} onClick={() => void consume.run()}>
          {t('providers.useResetCredit')} ({limits.resetCredits.availableCount})
        </Button>
      )}
    </Stack>
  );
}
