import { useCallback } from 'react';
import { Alert, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchChannelStats } from './api.js';

/** One channel's own numbers (DEC-36): what it sent and how its recipients answered. */
export function ChannelStatsView({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { state } = useQuery(useCallback(() => fetchChannelStats(id), [id]));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const s = state.data;
  return (
    <Stack>
      <MutedText>
        {t('channels.stats.cycle')} {s.cycle} · {t('channels.stats.progress')}: {s.sentThisCycle}/
        {s.ready}
      </MutedText>
      <MutedText>
        {t('channels.stats.sent')}: {s.sentTotal} · {t('channels.stats.batches')}: {s.batches} ·{' '}
        {t('channels.stats.answers')}: {s.answers} · {t('channels.stats.correct')}: {s.correct}
      </MutedText>
      {s.questions.length > 0 && <Subtitle>{t('channels.stats.questions')}</Subtitle>}
      {s.questions.map((q) => (
        <MutedText key={q.questionId}>
          <bdi>{q.stem}</bdi> · {q.sent} {t('channels.stats.times')} · {q.correct}/{q.answers}
        </MutedText>
      ))}
      {s.recent.length > 0 && <Subtitle>{t('channels.stats.recent')}</Subtitle>}
      {s.recent.map((b) => (
        <MutedText key={b.batchId}>
          {new Date(b.at).toLocaleString(locale)} · {b.questions}
        </MutedText>
      ))}
    </Stack>
  );
}
