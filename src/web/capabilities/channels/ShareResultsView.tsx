import { useCallback } from 'react';
import type { ShareResultsResponse } from '../../../contracts/sharing.js';
import { Alert, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchShareResults } from './api.js';
import { mostMissedFirst, percentText } from './results-order.js';

type Attempt = ShareResultsResponse['attempts'][number];

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const { t, locale } = useI18n();
  const done = attempt.status === 'submitted';
  const passed =
    attempt.passed === null
      ? '—'
      : t(attempt.passed ? 'sharing.results.yes' : 'sharing.results.no');
  const at = attempt.submittedAt ?? attempt.startedAt;
  return (
    <tr>
      <td>
        <bdi>{attempt.name ?? t('sharing.results.anonymous')}</bdi>
        {attempt.personId && <bdi> · {attempt.personId}</bdi>}
      </td>
      <td>{done ? `${attempt.correct ?? 0}/${attempt.total}` : t('sharing.results.inProgress')}</td>
      <td>{percentText(attempt.percent)}</td>
      <td>{passed}</td>
      <td>
        <time dateTime={at}>{new Date(at).toLocaleString(locale)}</time>
      </td>
    </tr>
  );
}

function AttemptsTable({ attempts }: { attempts: readonly Attempt[] }) {
  const { t } = useI18n();
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('sharing.results.name')}</th>
          <th scope="col">{t('sharing.results.score')}</th>
          <th scope="col">{t('sharing.results.percent')}</th>
          <th scope="col">{t('sharing.results.passed')}</th>
          <th scope="col">{t('sharing.results.when')}</th>
        </tr>
      </thead>
      <tbody>
        {attempts.map((attempt) => (
          <AttemptRow key={attempt.id} attempt={attempt} />
        ))}
      </tbody>
    </table>
  );
}

function QuestionsByMisses({ results }: { results: ShareResultsResponse }) {
  const { t } = useI18n();
  return (
    <>
      <Subtitle>{t('sharing.results.questions')}</Subtitle>
      <ol className="qb-list">
        {mostMissedFirst(results.questions).map((q) => (
          <li key={q.questionId} className="qb-list__item">
            <bdi>{q.stem}</bdi>
            <MutedText>
              {t('sharing.results.asked')} {q.asked} · {t('sharing.results.correct')} {q.correct}
            </MutedText>
          </li>
        ))}
      </ol>
    </>
  );
}

/** An exam or practice share's results: the summary, each attempt, and the most missed questions. */
export function ShareResultsView({ id }: { id: string }) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchShareResults(id), [id]));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const { summary, attempts } = state.data;
  if (attempts.length === 0) return <MutedText>{t('sharing.results.empty')}</MutedText>;
  return (
    <Stack>
      <MutedText>
        {t('sharing.results.started')}: {summary.started} · {t('sharing.results.submitted')}:{' '}
        {summary.submitted} · {t('sharing.results.average')}: {percentText(summary.averagePercent)}
        {summary.passed !== null && ` · ${t('sharing.results.passed')}: ${summary.passed}`}
      </MutedText>
      <AttemptsTable attempts={attempts} />
      <QuestionsByMisses results={state.data} />
    </Stack>
  );
}
