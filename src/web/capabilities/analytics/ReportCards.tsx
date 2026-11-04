import { useCallback } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  buttonClass,
  Card,
  MutedText,
  Row,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchHistory, fetchImportQuality, fetchSuggestion, fetchTrend } from './api.js';
import { RateText } from './RateText.js';

/** One useful next session (FR-16-010). */
export function SuggestionCard({ bankId }: { bankId: string }) {
  const { t, locale } = useI18n();
  const { state } = useQuery(useCallback(() => fetchSuggestion(bankId), [bankId]));
  if (state.status !== 'ready') return null;
  const { kind } = state.data;
  const target = `/study${bankId ? `?bank=${bankId}` : ''}`;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.suggestion')}</Subtitle>
        {kind === null ? (
          <MutedText>{t('analytics.suggestion.none')}</MutedText>
        ) : (
          <Row>
            <p lang={locale}>{t(`analytics.suggestion.${kind}`)}</p>
            <Link className={buttonClass()} to={target}>
              {t('analytics.suggestion.go')}
            </Link>
          </Row>
        )}
      </Stack>
    </Card>
  );
}

/** Accuracy week by week, small weeks said plainly (FR-16-003, UAT-065). */
export function TrendCard({ bankId }: { bankId: string }) {
  const { t, locale } = useI18n();
  const { state } = useQuery(useCallback(() => fetchTrend(bankId), [bankId]));
  if (state.status !== 'ready' || state.data.weeks.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.trend')}</Subtitle>
        {state.data.weeks.map((w) => (
          <MutedText key={w.weekStart}>
            {t('analytics.week')} {new Date(w.weekStart).toLocaleDateString(locale)}:{' '}
            <RateText rate={w.accuracy} />
            {w.smallSample ? ` · ${t('analytics.small')}` : ''}
          </MutedText>
        ))}
      </Stack>
    </Card>
  );
}

/** Every session with its result (FR-16-006): names change, the record stays. */
export function HistoryCard({ bankId, mode }: { bankId: string; mode: string }) {
  const { t, locale } = useI18n();
  const { state } = useQuery(useCallback(() => fetchHistory(bankId, mode), [bankId, mode]));
  if (state.status !== 'ready') return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.history')}</Subtitle>
        {state.data.sessions.length === 0 && <MutedText>{t('analytics.history.none')}</MutedText>}
        {state.data.sessions.slice(0, 50).map((s) => (
          <Row key={s.id}>
            <MutedText>
              {new Date(s.createdAt).toLocaleString(locale)} ·{' '}
              {t(s.mode === 'exam' ? 'exam.mode.exam' : 'exam.mode.tutor')} ·{' '}
              {t('analytics.history.score')} <RateText rate={s.score} /> · {t('analytics.accuracy')}
              : <RateText rate={s.accuracy} /> · {s.seconds}s
            </MutedText>
            <Link className={buttonClass('secondary')} to={`/study/sessions/${s.id}/summary`}>
              {t('analytics.history.open')}
            </Link>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}

/** What each import gave, apart from learning (FR-16-007, UAT-067). */
export function ImportsCard({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchImportQuality(bankId), [bankId]));
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  if (state.status !== 'ready' || state.data.sources.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.imports')}</Subtitle>
        {state.data.sources.map((s) => (
          <MutedText key={s.sourceId}>
            <bdi>{s.fileName}</bdi>: {s.found} {t('analytics.imports.found')} · {s.eligible}{' '}
            {t('analytics.imports.eligible')} · {s.needsReview} {t('analytics.imports.review')} ·{' '}
            {s.duplicates} {t('analytics.imports.duplicates')} · {s.missingAnswers}{' '}
            {t('analytics.imports.missing')} · {s.pictures} {t('analytics.imports.pictures')}
          </MutedText>
        ))}
      </Stack>
    </Card>
  );
}
