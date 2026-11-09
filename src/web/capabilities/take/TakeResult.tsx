import type { TakeResultResponse } from '../../../contracts/take.js';
import {
  Alert,
  Card,
  Grid,
  Heading,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { CountCard } from '../exam-ui/CountCard.js';

type Score = NonNullable<TakeResultResponse['score']>;
type Item = NonNullable<TakeResultResponse['items']>[number];

const ENDED: Record<NonNullable<TakeResultResponse['endedBy']>, MessageKey> = {
  person: 'take.result.submitted',
  time: 'exam.result.endedByTime',
  owner: 'take.result.endedByOwner',
};

/** The score the organiser chose to show, with its denominator, and pass or not if set. */
function ScoreView({ score }: { score: Score }) {
  const { t } = useI18n();
  return (
    <>
      <Grid>
        <CountCard label={t('take.result.right')} value={score.correct} of={score.total} />
      </Grid>
      <MutedText>
        {t('take.result.score')} {Math.round(score.percent)}%
      </MutedText>
      {score.passed !== null && (
        <Alert tone={score.passed ? 'success' : 'info'}>
          {t(score.passed ? 'take.result.passed' : 'take.result.notPassed')}
        </Alert>
      )}
    </>
  );
}

/** One answer as revealed: right or not in words, what was chosen, and the right answer. */
function ItemView({ item }: { item: Item }) {
  const { t } = useI18n();
  const verdict = item.correct ? `✓ ${t('study.correct')}` : `✕ ${t('study.wrong')}`;
  const chosen = item.chosen.length > 0 ? item.chosen.join(', ') : t('take.result.noAnswer');
  return (
    <li>
      <p dir="auto">{item.stem}</p>
      <p>
        {verdict} · {t('take.result.yourAnswer')} {chosen} · {t('study.rightAnswer')}{' '}
        {item.answers.join(', ')}
      </p>
      {item.explanation !== null && <p dir="auto">{item.explanation}</p>}
    </li>
  );
}

/** When more, or anything, will be shown; or that the organiser has released nothing. */
function Later({ result }: { result: TakeResultResponse }) {
  const { t, locale } = useI18n();
  const nothing = result.score === null && result.items === null;
  if (result.moreAt === null)
    return nothing ? <MutedText>{t('take.result.notReleased')}</MutedText> : null;
  const when = new Date(result.moreAt).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <Alert tone="info">
      {t(nothing ? 'take.result.laterAt' : 'take.result.moreAt')} {when}
    </Alert>
  );
}

/** The end of an attempt: exactly what the server revealed, nothing more. */
export function TakeResult({ result }: { result: TakeResultResponse }) {
  const { t } = useI18n();
  return (
    <Stack>
      <Heading>{t('take.result.title')}</Heading>
      {result.endedBy && (
        <Alert tone={result.endedBy === 'person' ? 'success' : 'info'}>
          {t(ENDED[result.endedBy])}
        </Alert>
      )}
      {result.score && <ScoreView score={result.score} />}
      {result.items && (
        <Card>
          <Stack>
            <Subtitle>{t('take.result.items')}</Subtitle>
            <ol className="qb-steps">
              {result.items.map((item) => (
                <ItemView key={item.position} item={item} />
              ))}
            </ol>
          </Stack>
        </Card>
      )}
      <Later result={result} />
    </Stack>
  );
}
