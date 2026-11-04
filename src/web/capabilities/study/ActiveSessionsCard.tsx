import { Link } from 'react-router';
import { buttonClass, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchActiveSessions } from './api.js';

/** Today's reviews, and open sessions to carry on from any device (FR-12-008, FR-15-005). */
export function ActiveSessionsCard() {
  const { t } = useI18n();
  const { state } = useQuery(fetchActiveSessions);
  const sessions = state.status === 'ready' ? state.data.sessions : [];
  return (
    <Card>
      <Stack>
        <Link className={buttonClass()} to="/study/plan">
          {t('plan.link')}
        </Link>
        {sessions.length > 0 && <Subtitle>{t('study.active.title')}</Subtitle>}
        {sessions.map((s) => (
          <Row key={s.id}>
            <MutedText>
              {t(`study.kind.${s.kind === 'retry' ? 'wrong' : s.kind}`)} · {s.answered}/{s.total}{' '}
              {t('study.answered')}
            </MutedText>
            <Link
              className={buttonClass('secondary')}
              to={`/${s.mode === 'exam' ? 'exam' : 'study'}/sessions/${s.id}`}
            >
              {t('study.active.resume')}
            </Link>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}
