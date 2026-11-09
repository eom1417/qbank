import { useState } from 'react';
import type { ShareSecretResponse, ShareView } from '../../../contracts/sharing.js';
import { Badge, Button, Card, MutedText, Row, Stack, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { ShareDetails } from './ShareDetails.js';
import { KIND_ICON, usesLabel } from './share-labels.js';

interface Props {
  share: ShareView;
  onChanged(): void;
  onSecret(created: ShareSecretResponse): void;
}

/** The line every share shows: kind, name, status, how much is ready, how much it was used. */
export function ShareSummary({ share }: { share: ShareView }) {
  const { t, locale } = useI18n();
  const used = share.lastUsedAt
    ? `${t('sharing.lastUsed')}: ${new Date(share.lastUsedAt).toLocaleString(locale)}`
    : t('sharing.neverUsed');
  return (
    <>
      <Row>
        <Title>
          <span aria-hidden="true">{KIND_ICON[share.kind]}</span> <bdi>{share.name}</bdi>
        </Title>
        <Badge>{t(`sharing.kind.${share.kind}`)}</Badge>
        <Badge>{t(`sharing.status.${share.status}`)}</Badge>
      </Row>
      <MutedText>
        {t('sharing.ready')}: {share.ready} · {t(usesLabel(share.kind))}: {share.uses} · {used} ·{' '}
        <bdi>{share.keyPrefix}…</bdi>
      </MutedText>
    </>
  );
}

/** One share of the bank, opened on demand for its controls, record and results. */
export function ShareItem({ share, onChanged, onSecret }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Stack>
        <ShareSummary share={share} />
        <Row>
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t(open ? 'sharing.details.hide' : 'sharing.details.show')}
          </Button>
        </Row>
        {open && <ShareDetails share={share} onChanged={onChanged} onSecret={onSecret} />}
      </Stack>
    </Card>
  );
}
