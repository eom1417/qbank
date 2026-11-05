import type { InstanceConfig, ProviderView } from '../../../contracts/providers.js';
import { Button, ConfirmButton, Row } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useProviderAccess } from './access.js';
import { removeInstance } from './instances.js';
import { providerActions } from './provider-actions.js';

interface ActionsProps {
  provider: ProviderView;
  /** The stored config; absent for a built-in default instance. */
  config: InstanceConfig | undefined;
  onError(error: unknown): void;
}

/** The buttons of one provider; an added instance can also be removed (two clicks). */
export function ProviderActions({ provider, config, onError }: ActionsProps) {
  const { t } = useI18n();
  const { operator } = useProviderAccess();
  const run = useAction(async (work: () => Promise<unknown>) => {
    await work().catch(onError);
  });
  const removable = config !== undefined && provider.instanceId !== provider.driver;
  return (
    <Row>
      {providerActions(provider, config, operator).map((action) => (
        <Button
          key={action.key}
          variant={action.variant}
          busy={run.busy}
          onClick={() => void run.run(action.work)}
        >
          {t(action.label)}
          {action.detail ? ` ${action.detail}` : ''}
        </Button>
      ))}
      {removable && (
        <ConfirmButton
          label={t('providers.remove')}
          confirmLabel={t('providers.confirmRemove')}
          onConfirm={() => void run.run(() => removeInstance(provider.instanceId))}
        />
      )}
    </Row>
  );
}
