import type { AnalyticsSummary } from '../../../contracts/analytics.js';
import { Card, Grid, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { RateText } from './RateText.js';

function Figures({ title, rows }: { title: MessageKey; rows: [MessageKey, number][] }) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Subtitle>{t(title)}</Subtitle>
        {rows.map(([label, value]) => (
          <MutedText key={label}>
            {t(label)} {value}
          </MutedText>
        ))}
      </Stack>
    </Card>
  );
}

/** Accuracy with its definition, and answers that may be the question's fault (FR-16-009). */
function AccuracyCard({ summary }: { summary: AnalyticsSummary }) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.accuracy')}</Subtitle>
        <p>
          <RateText rate={summary.accuracy} />
        </p>
        <MutedText>{t('analytics.accuracy.def')}</MutedText>
        <MutedText>{t('analytics.score.def')}</MutedText>
        {summary.possibleQuestionProblems > 0 && (
          <MutedText>
            {t('analytics.problems')} {summary.possibleQuestionProblems}.{' '}
            {t('analytics.problems.note')}
          </MutedText>
        )}
      </Stack>
    </Card>
  );
}

/** Time apart from correctness (FR-16-005). */
function TimeCard({ summary }: { summary: AnalyticsSummary }) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Subtitle>{t('analytics.time')}</Subtitle>
        <MutedText>
          {t('analytics.time.question')} {summary.seconds.perQuestion ?? '—'}
        </MutedText>
        <MutedText>
          {t('analytics.time.session')} {summary.seconds.perSession ?? '—'}
        </MutedText>
        <MutedText>{t('analytics.time.note')}</MutedText>
      </Stack>
    </Card>
  );
}

/** The library in real numbers (FR-16-001, FR-01-010), each figure with its definition. */
export function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const q = summary.questions;
  const l = summary.learning;
  const questionRows: [MessageKey, number][] = [
    ['analytics.q.total', q.total],
    ['analytics.q.eligible', q.eligible],
    ['analytics.q.needsReview', q.needsReview],
    ['analytics.q.detected', q.detected],
    ['analytics.q.excluded', q.excluded],
    ['analytics.q.duplicates', q.duplicates],
  ];
  const learningRows: [MessageKey, number][] = [
    ['analytics.l.new', l.new],
    ['analytics.l.answered', l.answered],
    ['analytics.l.weak', l.weak],
    ['analytics.l.mastered', l.mastered],
    ['analytics.l.due', l.due],
  ];
  return (
    <Grid>
      <Figures title="analytics.questions" rows={questionRows} />
      <Figures title="analytics.learning" rows={learningRows} />
      <AccuracyCard summary={summary} />
      <TimeCard summary={summary} />
    </Grid>
  );
}
