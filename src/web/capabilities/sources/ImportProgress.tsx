import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ImportResponse } from '../../../contracts/sources.js';
import { Alert, Badge, Button, MutedText, Row } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { cancelImport, fetchImport, FINISHED_STAGES, queueMessage } from './api.js';

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

/** Live progress of one file: its stage, pages read of the range, questions found so far. */
interface RowProps {
  initial: ImportResponse;
  /** Removes a file whose import has not started (FR-04-008). */
  onCancel?(): void;
}

export function ImportProgressRow({ initial, onCancel }: RowProps) {
  const { t } = useI18n();
  const [job] = usePolledImport(initial);
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
