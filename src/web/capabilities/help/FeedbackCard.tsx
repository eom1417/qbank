import { useState } from 'react';
import { SupportReportResponse } from '../../../contracts/portability.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  MutedText,
  SelectField,
  Stack,
  Subtitle,
  TextArea,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { useModeCopy } from '../identity/mode-copy.js';
import { useSession } from '../identity/session.js';
import { sendFeedback } from '../operator/api.js';
import { feedbackMessage, feedbackUrl, KINDS, type Kind } from './feedback-note.js';

/** The rate limit has its own words here; the generic one speaks of wrong codes. */
const sendError = (key: MessageKey): MessageKey =>
  key === 'error.too_many_attempts' ? 'feedback.toOperator.tooMany' : key;

function useFeedbackFields() {
  const [kind, setKind] = useState<Kind>('problem');
  const [tried, setTried] = useState('');
  const [happened, setHappened] = useState('');
  const clear = () => (setTried(''), setHappened(''));
  return { kind, setKind, tried, setTried, happened, setHappened, clear };
}
type Fields = ReturnType<typeof useFeedbackFields>;

function FeedbackFields({ fields }: { fields: Fields }) {
  const { t } = useI18n();
  return (
    <>
      <SelectField
        label={t('feedback.kind')}
        value={fields.kind}
        onChange={(event) => fields.setKind(event.target.value as Kind)}
        options={KINDS.map((value) => ({ value, label: t(`feedback.kind.${value}`) }))}
      />
      <TextArea
        label={t('feedback.tried')}
        value={fields.tried}
        onChange={(e) => fields.setTried(e.target.value)}
      />
      <TextArea
        label={t('feedback.happened')}
        value={fields.happened}
        onChange={(e) => fields.setHappened(e.target.value)}
      />
    </>
  );
}

/**
 * Local install (M28.2): it opens a new GitHub issue filled in with the fields and, if the owner
 * keeps it ticked, the support report. Nothing is sent from here: the owner submits it on GitHub.
 */
function GitHubFeedback() {
  const { t } = useI18n();
  const fields = useFeedbackFields();
  const [withReport, setWithReport] = useState(true);
  const open = useAction(async () => {
    const report = withReport
      ? await apiRequest('GET', '/api/support/report', SupportReportResponse)
      : null;
    window.open(
      feedbackUrl(fields.kind, fields.tried, fields.happened, report),
      '_blank',
      'noopener',
    );
  });
  return (
    <>
      <MutedText>{t('feedback.lead')}</MutedText>
      <FeedbackFields fields={fields} />
      <Checkbox
        checked={withReport}
        onChange={(event) => setWithReport(event.target.checked)}
        label={t('feedback.withReport')}
      />
      <Button disabled={!fields.tried.trim()} busy={open.busy} onClick={() => void open.run()}>
        {t('feedback.open')}
      </Button>
    </>
  );
}

/** On a server (M31, B1): the note goes to its operator, with the screen it was sent from. */
function ServerFeedback() {
  const { t } = useI18n();
  const copy = useModeCopy();
  const fields = useFeedbackFields();
  const [sent, setSent] = useState(false);
  const send = useAction(async () => {
    setSent(false);
    const message = feedbackMessage(fields.kind, fields.tried, fields.happened);
    await sendFeedback({ message, screen: window.location.pathname });
    fields.clear();
    setSent(true);
  });
  return (
    <>
      <MutedText>{copy('feedback.lead')}</MutedText>
      <FeedbackFields fields={fields} />
      {send.error && <Alert tone="error">{t(sendError(send.error))}</Alert>}
      {sent && <Alert tone="success">{copy('feedback.toOperator.sent')}</Alert>}
      <Button disabled={!fields.tried.trim()} busy={send.busy} onClick={() => void send.run()}>
        {t('feedback.toOperator.send')}
      </Button>
    </>
  );
}

/** «Send feedback»: to GitHub on a local install, to the server's operator otherwise. */
export function FeedbackCard() {
  const { t } = useI18n();
  const { mode } = useSession();
  if (mode === null) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('feedback.title')}</Subtitle>
        {mode === 'accounts' ? <ServerFeedback /> : <GitHubFeedback />}
      </Stack>
    </Card>
  );
}
