import type { ShareSecretResponse, ShareView } from '../../../contracts/sharing.js';
import { Alert, Button, ConfirmButton, Row, Stack } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';
import { changeShare, deleteShare, renewSecret } from './api.js';
import { allowedControls } from './share-labels.js';

interface Props {
  share: ShareView;
  onChanged(): void;
  /** A renewed key or link, to show once. */
  onSecret(created: ShareSecretResponse): void;
}

interface Control {
  shown: boolean;
  label: MessageKey;
  /** Set for the steps that take a second, deliberate click. */
  confirm?: MessageKey;
  run(): Promise<unknown>;
}

/** The lifecycle steps this share allows now, in the order they are offered. */
function controlsOf(share: ShareView, onSecret: Props['onSecret']): Control[] {
  const can = allowedControls(share.status);
  const step = (action: 'pause' | 'resume' | 'end' | 'archive') => () =>
    changeShare(share.id, action);
  return [
    { shown: can.pause, label: 'sharing.pause', run: step('pause') },
    { shown: can.resume, label: 'sharing.resume', run: step('resume') },
    {
      shown: can.renew,
      label: share.kind === 'agent' ? 'sharing.renew.agent' : 'sharing.renew.link',
      confirm: 'sharing.renewConfirm',
      run: async () => onSecret(await renewSecret(share.id)),
    },
    { shown: can.end, label: 'sharing.end', confirm: 'sharing.endConfirm', run: step('end') },
    {
      shown: can.archive,
      label: 'sharing.archive',
      confirm: 'sharing.archiveConfirm',
      run: step('archive'),
    },
    {
      shown: true,
      label: 'sharing.delete',
      confirm: 'sharing.deleteConfirm',
      run: () => deleteShare(share.id),
    },
  ];
}

/** Question 6, control: pause or resume, renew the secret, end, archive, delete. */
export function ShareControls({ share, onChanged, onSecret }: Props) {
  const { t } = useI18n();
  const act = useAction(async (work: () => Promise<unknown>) => {
    await work();
    onChanged();
  });
  const controls = controlsOf(share, onSecret).filter((c) => c.shown);
  return (
    <Stack>
      {act.error && <Alert tone="error">{t(act.error)}</Alert>}
      <Row>
        {controls.map((c) =>
          c.confirm ? (
            <ConfirmButton
              key={c.label}
              label={t(c.label)}
              confirmLabel={t(c.confirm)}
              busy={act.busy}
              onConfirm={() => void act.run(c.run)}
            />
          ) : (
            <Button
              key={c.label}
              variant="secondary"
              busy={act.busy}
              onClick={() => void act.run(c.run)}
            >
              {t(c.label)}
            </Button>
          ),
        )}
      </Row>
    </Stack>
  );
}
