import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  buttonClass,
  ConfirmButton,
  Heading,
  MutedText,
  Row,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { CheckSummary } from '../exam-ui/CheckSummary.js';
import { fetchExamState, submitExam } from './api.js';

/**
 * The check before submitting (FR-13-010, UI-18, UAT-054): answered, unanswered and flagged,
 * links back where the rules allow, and a deliberate two-step submission.
 */
export function ExamCheckScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const sessionId = useParams()['id'] ?? '';
  const { state } = useQuery(useCallback(() => fetchExamState(sessionId), [sessionId]));
  const submit = useAction(async () => {
    await submitExam(sessionId);
    void navigate(`/study/sessions/${sessionId}/summary`);
  });
  if (state.status !== 'ready') return <MutedText>{t('common.loading')}</MutedText>;
  const items = state.data.items;
  const back = (position: number) => `/exam/sessions/${sessionId}?at=${position}`;
  return (
    <Stack>
      <Heading>{t('exam.check.title')}</Heading>
      <CheckSummary items={items} />
      <Row>
        {items
          .filter((i) => (!i.answered || i.flagged) && i.changeable)
          .map((i) => (
            <Link key={i.position} className={buttonClass('secondary')} to={back(i.position)}>
              {i.position + 1}
            </Link>
          ))}
      </Row>
      {submit.error && <Alert tone="error">{t(submit.error)}</Alert>}
      <Row>
        <Link className={buttonClass('secondary')} to={back(state.data.position)}>
          {t('exam.check.back')}
        </Link>
        <ConfirmButton
          label={t('exam.submit')}
          confirmLabel={t('exam.submit.confirm')}
          busy={submit.busy}
          onConfirm={() => void submit.run()}
        />
      </Row>
    </Stack>
  );
}
