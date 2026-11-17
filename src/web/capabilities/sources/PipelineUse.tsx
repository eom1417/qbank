import { useNavigate } from 'react-router';
import type { ImportResponse } from '../../../contracts/sources.js';
import { Alert, Button, MutedText, Title } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { cancelImport } from './api.js';
import { PipelineFacts } from './PipelineFacts.js';

/**
 * A pipeline import paused by a full subscription: when it goes on by itself, and the owner's
 * way to stop waiting (Q16): cancelling removes the file, as for a file still queued.
 */
export function PausedNote({ job }: { job: ImportResponse }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const cancel = useAction(async () => {
    await cancelImport(job.id);
    await navigate(`/banks/${job.bankId}`);
  });
  const at = job.ai?.resumesAt;
  if (!at) return null;
  return (
    <>
      <Alert tone="info">
        {t('import.paused')} <bdi>{new Date(at).toLocaleTimeString(locale)}</bdi>
      </Alert>
      {cancel.error && <Alert tone="error">{t(cancel.error)}</Alert>}
      <Button variant="ghost" busy={cancel.busy} onClick={() => void cancel.run()}>
        {t('import.cancelPaused')}
      </Button>
    </>
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
      <PipelineFacts job={job} />
    </>
  );
}
