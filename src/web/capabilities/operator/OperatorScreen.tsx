import type { ReactNode } from 'react';
import { Alert, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from '../identity/session.js';
import { fetchFeedback } from './api.js';
import { BackupCard } from './BackupCard.js';
import { FeedbackInbox } from './FeedbackInbox.js';
import { ImportQueueCard } from './ImportQueueCard.js';
import { ResetRequestsCard } from './ResetRequestsCard.js';

/**
 * «Server administration» (M31, DEC-40): feedback, backups, password resets (none on a
 * Google-only server, DEC-42) and the import queue. The server decides who may see it: the first
 * answer (feedback) settles it, and no other card asks the server before it says yes, so anyone
 * else sees its 403 message once, and nothing else.
 */
export function OperatorScreen() {
  const { t } = useI18n();
  const { signInMethod } = useSession();
  const feedback = useQuery(fetchFeedback);
  const { state } = feedback;
  let body: ReactNode;
  if (state.status === 'loading') body = <MutedText>{t('common.loading')}</MutedText>;
  else if (state.status === 'error') body = <Alert tone="error">{t(state.error)}</Alert>;
  else
    body = (
      <>
        <MutedText>{t('operator.lead')}</MutedText>
        <FeedbackInbox state={state} reload={feedback.reload} />
        <BackupCard />
        {signInMethod !== 'google' && <ResetRequestsCard />}
        <ImportQueueCard />
      </>
    );
  return (
    <Stack>
      <Heading>{t('operator.title')}</Heading>
      {body}
    </Stack>
  );
}
