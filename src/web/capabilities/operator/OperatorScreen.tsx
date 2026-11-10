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
 * Google-only server, DEC-42) and the import queue. The server decides who may see it: anyone
 * else gets its 403 message here, and nothing else.
 */
export function OperatorScreen() {
  const { t } = useI18n();
  const { signInMethod } = useSession();
  const feedback = useQuery(fetchFeedback);
  const denied = feedback.state.status === 'error' && feedback.state.error;
  return (
    <Stack>
      <Heading>{t('operator.title')}</Heading>
      {denied ? (
        <Alert tone="error">{t(denied)}</Alert>
      ) : (
        <>
          <MutedText>{t('operator.lead')}</MutedText>
          <FeedbackInbox state={feedback.state} reload={feedback.reload} />
          <BackupCard />
          {signInMethod !== 'google' && <ResetRequestsCard />}
          <ImportQueueCard />
        </>
      )}
    </Stack>
  );
}
