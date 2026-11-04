import { Link } from 'react-router';
import { buttonClass, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchActiveSessions } from './api.js';

/** Open sessions on the library, to carry on from any device (FR-12-008, UAT-047). */
export function ActiveSessionsCard() {
  const { t } = useI18n();
  const { state } = useQuery(fetchActiveSessions);
  if (state.status !== 'ready' || state.data.sessions.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('study.active.title')}</Subtitle>
        {state.data.sessions.map((s) => (
          <Row key={s.id}>
            <MutedText>
              {t(`study.kind.${s.kind === 'retry' ? 'wrong' : s.kind}`)} · {s.answered}/{s.total}{' '}
              {t('study.answered')}
            </MutedText>
            <Link className={buttonClass('secondary')} to={`/study/sessions/${s.id}`}>
              {t('study.active.resume')}
            </Link>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}
