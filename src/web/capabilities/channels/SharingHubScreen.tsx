import { useCallback } from 'react';
import { Link } from 'react-router';
import type { ShareView } from '../../../contracts/sharing.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Heading,
  MutedText,
  Row,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { changeShare, fetchShares } from './api.js';
import { ShareSummary } from './ShareItem.js';
import { allowedControls } from './share-labels.js';

/** One share in the hub: its line, its bank, and a quick pause or resume. */
function HubItem({ share, onChanged }: { share: ShareView; onChanged(): void }) {
  const { t } = useI18n();
  const can = allowedControls(share.status);
  const act = useAction(async (action: 'pause' | 'resume') => {
    await changeShare(share.id, action);
    onChanged();
  });
  return (
    <Card>
      <Stack>
        <ShareSummary share={share} />
        <MutedText>
          {t('sharing.bank')}: <bdi>{share.bankName}</bdi>
        </MutedText>
        {act.error && <Alert tone="error">{t(act.error)}</Alert>}
        <Row>
          {(can.pause || can.resume) && (
            <Button
              variant="secondary"
              busy={act.busy}
              onClick={() => void act.run(can.pause ? 'pause' : 'resume')}
            >
              {t(can.pause ? 'sharing.pause' : 'sharing.resume')}
            </Button>
          )}
          <Link to={`/banks/${share.bankId}/channels`}>{t('sharing.hub.open')}</Link>
        </Row>
      </Stack>
    </Card>
  );
}

const lastActivity = (share: ShareView) => share.lastUsedAt ?? share.createdAt;

/** Every share of every bank in one place, the most recently active first. */
export function SharingHubScreen() {
  const { t } = useI18n();
  const { state, reload } = useQuery(useCallback(() => fetchShares(), []));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const shares = [...state.data.shares].sort((a, b) =>
    lastActivity(b).localeCompare(lastActivity(a)),
  );
  return (
    <Stack>
      <Heading>{t('sharing.hub.title')}</Heading>
      <MutedText>{t('sharing.hub.lead')}</MutedText>
      {shares.length === 0 && (
        <EmptyState title={t('sharing.hub.title')} description={t('sharing.hub.empty')} />
      )}
      {shares.map((share) => (
        <HubItem key={share.id} share={share} onChanged={reload} />
      ))}
    </Stack>
  );
}
