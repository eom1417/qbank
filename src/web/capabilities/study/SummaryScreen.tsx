import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  buttonClass,
  Card,
  Grid,
  Heading,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchSummary, retryWrong } from './api.js';

/** A count and what it is out of: rates never hide their denominator (FR-12-010). */
function Count({ label, value, of }: { label: string; value: number; of: number }) {
  const { t } = useI18n();
  return (
    <Card>
      <Subtitle>{label}</Subtitle>
      <p>
        {value} {t('study.summary.outOf')} {of}
      </p>
    </Card>
  );
}

/** The end of a session (UI-15, JY-07): honest counts, mistakes to retry, or a kind word. */
export function SummaryScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const sessionId = useParams()['id'] ?? '';
  const { state } = useQuery(useCallback(() => fetchSummary(sessionId), [sessionId]));
  const retry = useAction(async () => {
    const session = await retryWrong(sessionId);
    void navigate(`/study/sessions/${session.id}`);
  });
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const s = state.data;
  return (
    <Stack>
      <Heading>{t('study.summary.title')}</Heading>
      <Grid>
        <Count label={t('study.summary.answered')} value={s.answered} of={s.total} />
        <Count label={t('study.summary.correct')} value={s.correct} of={s.answered} />
        <Count label={t('study.summary.wrong')} value={s.wrong} of={s.answered} />
        <Count label={t('study.summary.skipped')} value={s.skipped} of={s.total} />
      </Grid>
      <MutedText>
        {t('study.summary.time')} {s.seconds}
      </MutedText>
      {s.wrong === 0 ? (
        <Alert tone="success">{t('study.summary.noWrong')}</Alert>
      ) : (
        <Card>
          <Stack>
            <Subtitle>{t('study.summary.wrongList')}</Subtitle>
            {s.wrongItems.map((w) => (
              <p key={w.position} dir="auto">
                {w.position + 1}. {w.excerpt}
              </p>
            ))}
            <Button busy={retry.busy} onClick={() => void retry.run()}>
              {t('study.summary.retry')}
            </Button>
          </Stack>
        </Card>
      )}
      {retry.error && <Alert tone="error">{t(retry.error)}</Alert>}
      <Link className={buttonClass('secondary')} to="/">
        {t('study.summary.back')}
      </Link>
    </Stack>
  );
}
