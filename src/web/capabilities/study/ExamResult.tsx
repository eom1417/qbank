import { useCallback } from 'react';
import { Link } from 'react-router';
import type { SummaryResponse } from '../../../contracts/study.js';
import { Alert, buttonClass, Card, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchSession } from './api.js';

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/**
 * An exam's result (FR-13-013, UI-19, UAT-056): the score counts every question, the accuracy
 * only the answered ones, both with their formula (DEC-08 assumed); then each answer to review.
 */
export function ExamResult({
  sessionId,
  summary,
}: {
  sessionId: string;
  summary: SummaryResponse;
}) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchSession(sessionId), [sessionId]));
  if (state.status !== 'ready' || state.data.mode !== 'exam') return null;
  return (
    <Card>
      <Stack>
        {state.data.endedBy === 'time' && <Alert tone="info">{t('exam.result.endedByTime')}</Alert>}
        <MutedText>
          {t('exam.result.score')} {summary.correct} / {summary.total} ={' '}
          {percent(summary.correct, summary.total)}%
        </MutedText>
        <MutedText>
          {t('exam.result.accuracy')} {summary.correct} / {summary.answered} ={' '}
          {percent(summary.correct, summary.answered)}%
        </MutedText>
        <Link className={buttonClass('secondary')} to={`/study/sessions/${sessionId}`}>
          {t('exam.result.review')}
        </Link>
      </Stack>
    </Card>
  );
}
