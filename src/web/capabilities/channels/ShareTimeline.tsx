import { useCallback } from 'react';
import { Alert, MutedText } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchShareEvents } from './api.js';

/** "What happened": the share's append-only record, newest first (DEC-39). */
export function ShareTimeline({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { state } = useQuery(useCallback(() => fetchShareEvents(id), [id]));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const events = [...state.data.events].sort((a, b) => b.at.localeCompare(a.at));
  if (events.length === 0) return <MutedText>{t('sharing.timeline.empty')}</MutedText>;
  return (
    <ol className="qb-list">
      {events.map((event, index) => (
        <li key={`${event.at}-${index}`} className="qb-list__item">
          <span>
            <strong>{t(`sharing.event.${event.type}`)}</strong> ·{' '}
            <time dateTime={event.at}>{new Date(event.at).toLocaleString(locale)}</time> ·{' '}
            {t('sharing.timeline.version')} {event.version}
          </span>
        </li>
      ))}
    </ol>
  );
}
