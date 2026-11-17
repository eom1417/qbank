import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ImportResponse } from '../../../contracts/sources.js';
import { Alert, Badge, Button, MutedText, Row } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { cancelImport, fetchImport, FINISHED_STAGES, queueMessage, retryImport } from './api.js';

const POLL_MS = 2000;

/** Follows one import until it ends (UI-08); `setJob` restarts it with a newer state. */
export function usePolledImport(initial: ImportResponse) {
  const [job, setJob] = useState(initial);
  useEffect(() => {
    if (FINISHED_STAGES.has(job.stage)) return;
    const timer = setTimeout(() => void fetchImport(job.id).then(setJob, () => undefined), POLL_MS);
    return () => clearTimeout(timer);
  }, [job]);
  return [job, setJob] as const;
}

/** A waiting file's place in the server's queue, instead of a bare "waiting". */
export function QueueNote({ job }: { job: ImportResponse }) {
  const { t, locale } = useI18n();
  const place = job.stage === 'queued' ? queueMessage(locale, job.queuePosition) : null;
  return place && <MutedText>{fill(t(place.key), { n: place.n })}</MutedText>;
}

/** Errors whose cause is the AI's own status, said after them (M36 Q114). */
const AI_STOPS = new Set(['ai_failed', 'ai_stopped']);

/** Why an import ended, said wherever the import is shown (M36 Q109): the AI's own reason too. */
export function ImportErrorNote({ job }: { job: ImportResponse }) {
  const { t } = useI18n();
  if (!job.errorCode) return null;
  const why = AI_STOPS.has(job.errorCode) && job.aiOutcome;
  return (
    <Alert tone="error">
      {t(`import.error.${job.errorCode}` as 'import.error.internal')}
      {why && ` ${t(`ai.status.${job.aiOutcome}` as 'ai.status.invalid_key')} `}
      {why && job.aiDetail && (
        <>
          {' '}
          {t('import.ai.providerSaid')} <bdi>«{job.aiDetail}»</bdi>{' '}
        </>
      )}
      {why && <Link to="/settings/providers">{t('import.ai.openProviders')}</Link>}
    </Alert>
  );
}

/** Stages a finished import can be run again from, without uploading the file again. */
const RETRYABLE = new Set(['failed', 'partial_failure', 'needs_review']);

/** Runs the import again from where it stopped (the step cache keeps what the AI answered). */
export function RetryImport({
  job,
  onRetried,
}: {
  job: ImportResponse;
  onRetried(next: ImportResponse): void;
}) {
  const { t } = useI18n();
  const retry = useAction(async () => onRetried(await retryImport(job.id, {})));
  if (!RETRYABLE.has(job.stage)) return null;
  return (
    <>
      {retry.error && <Alert tone="error">{t(retry.error)}</Alert>}
      <Button variant="secondary" busy={retry.busy} onClick={() => void retry.run()}>
        {t('import.retry')}
      </Button>
    </>
  );
}

/** Live progress of one file: its stage, pages read of the range, questions found so far. */
interface RowProps {
  initial: ImportResponse;
  /** Removes a file whose import has not started (FR-04-008). */
  onCancel?(): void;
}

export function ImportProgressRow({ initial, onCancel }: RowProps) {
  const { t } = useI18n();
  const [job, setJob] = usePolledImport(initial);
  const done = FINISHED_STAGES.has(job.stage);
  return (
    <li className="qb-list__item">
      <Row>
        <Link className="qb-grow" to={`/imports/${job.id}`}>
          <bdi>{job.fileName}</bdi>
        </Link>
        <Badge>{t(`import.stage.${job.stage}`)}</Badge>
      </Row>
      <MutedText>
        {t('import.pagesRead')}: {job.pagesDone} / {job.pagesTotal}
        {done &&
          ` · ${t('source.questions')}: ${job.questionsFound} · ${t('source.review')}: ${job.questionsReview}`}
      </MutedText>
      <QueueNote job={job} />
      <ImportErrorNote job={job} />
      {job.errorCode && <RetryImport job={job} onRetried={setJob} />}
      {job.stage === 'completed' && <Alert tone="success">{t('import.completedNotice')}</Alert>}
      {job.stage === 'queued' && onCancel && (
        <Button
          variant="ghost"
          onClick={() => void cancelImport(job.id).then(onCancel, () => undefined)}
        >
          {t('import.cancel')}
        </Button>
      )}
    </li>
  );
}
