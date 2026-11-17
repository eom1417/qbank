import type { ImportResponse } from '../../../contracts/sources.js';
import { Alert, MutedText, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** A pipeline import paused by a full subscription: when it goes on by itself (Q16). */
export function PausedNote({ job }: { job: ImportResponse }) {
  const { t, locale } = useI18n();
  const at = job.ai?.resumesAt;
  if (!at) return null;
  return (
    <Alert tone="info">
      {t('import.paused')} <bdi>{new Date(at).toLocaleTimeString(locale)}</bdi>
    </Alert>
  );
}

/** What the pipeline's AI steps cost (tokens per step, estimated or reported) and the review. */
export function PipelineUse({ job }: { job: ImportResponse }) {
  const { t } = useI18n();
  if (job.ai?.mode !== 'pipeline') return null;
  return (
    <>
      <Title>{t('import.usage.title')}</Title>
      <ul className="qb-list">
        {job.ai.usage.map((row) => (
          <li key={`${row.lesson} ${row.model}`} className="qb-list__item">
            {t('import.usage.lesson')} <bdi>{row.lesson}</bdi> (<bdi>{row.model}</bdi>) ·{' '}
            {t('import.usage.calls')}: {row.calls} · {t('import.usage.tokens')}: {row.inputTokens} /{' '}
            {row.outputTokens}
            {row.estimated && ` (${t('import.usage.estimated')})`}
          </li>
        ))}
      </ul>
      <MutedText>
        {t('import.usage.review')}: {job.questionsReview}
      </MutedText>
    </>
  );
}
