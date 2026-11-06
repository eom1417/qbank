import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import type { ImportResponse } from '../../../contracts/sources.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  Heading,
  MutedText,
  Row,
  Stack,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { fetchImport, FINISHED_STAGES, retryImport } from './api.js';
import { usePolledImport } from './ImportProgress.js';
import { MediaCard } from './MediaCard.js';
import { AiUsed } from './AiUsed.js';

const RETRYABLE = new Set(['failed', 'partial_failure', 'needs_review']);

/** What the AI step did, in words the user can act on. */
function aiOutcomeKey(outcome: string | null): MessageKey | null {
  if (!outcome || outcome === 'not_used') return null;
  if (outcome === 'done') return 'import.ai.done';
  if (outcome === 'not_ready') return 'import.ai.notReady';
  return 'import.ai.stopped';
}

/** Why the AI step stopped is a readiness status (an expired key, no quota…). */
/** Why the AI stopped, when the fix is on the providers screen (sign in again, a limit, a model). */
const FIXED_IN_PROVIDERS = new Set([
  'invalid_key',
  'no_permission',
  'no_quota',
  'rate_limited',
  'model_missing',
  'not_ready',
]);

function AiOutcome({ outcome }: { outcome: string | null }) {
  const { t } = useI18n();
  const key = aiOutcomeKey(outcome);
  if (!key) return null;
  const why =
    key === 'import.ai.stopped' ? ` (${t(`ai.status.${outcome}` as 'ai.status.invalid_key')})` : '';
  return (
    <Alert tone={outcome === 'done' ? 'success' : 'info'}>
      {`${t(key)}${why}`}
      {FIXED_IN_PROVIDERS.has(outcome ?? '') && (
        <>
          {' '}
          <Link to="/settings/providers">{t('import.ai.openProviders')}</Link>
        </>
      )}
    </Alert>
  );
}

function PageIssues({ job }: { job: ImportResponse }) {
  const { t } = useI18n();
  if (job.pages.length === 0) return <MutedText>{t('import.report.cleanPages')}</MutedText>;
  return (
    <ul className="qb-list">
      {/* A page can be reported more than once (one line per problem), so the line is the key. */}
      {job.pages.map((page, line) => (
        <li key={line} className="qb-list__item">
          {t('import.report.page')} {page.page}:{' '}
          {t(`import.page.${page.warning ?? page.status}` as 'import.page.ocr')}
        </li>
      ))}
    </ul>
  );
}

function Report({ initial }: { initial: ImportResponse }) {
  const { t } = useI18n();
  const [job, setJob] = usePolledImport(initial);
  const retry = useAction(async () => setJob(await retryImport(job.id, {})));
  return (
    <Stack>
      <Link to={`/banks/${job.bankId}`}>{t('import.back')}</Link>
      <Heading>
        <bdi>{job.fileName}</bdi>
      </Heading>
      <Card>
        <Row>
          <Title>{t('import.report.title')}</Title>
          <Badge>{t(`import.stage.${job.stage}`)}</Badge>
        </Row>
        <MutedText>
          {t('import.pagesRead')}: {job.pagesDone} / {job.pagesTotal}
        </MutedText>
        {FINISHED_STAGES.has(job.stage) && (
          <MutedText>
            {t('source.questions')}: {job.questionsFound} · {t('source.review')}:{' '}
            {job.questionsReview}
          </MutedText>
        )}
        <AiOutcome outcome={job.aiOutcome} />
        <AiUsed ai={job.ai} />
        {job.errorCode && (
          <Alert tone="error">
            {t(`import.error.${job.errorCode}` as 'import.error.internal')}
          </Alert>
        )}
        <Title>{t('import.report.pages')}</Title>
        <PageIssues job={job} />
        {retry.error && <Alert tone="error">{t(retry.error)}</Alert>}
        {RETRYABLE.has(job.stage) && (
          <Button variant="secondary" busy={retry.busy} onClick={() => void retry.run()}>
            {t('import.retry')}
          </Button>
        )}
      </Card>
      {FINISHED_STAGES.has(job.stage) && <MediaCard importId={job.id} />}
    </Stack>
  );
}

/** One file's import result (UI-09, FR-04-011): what was read, what needs review, and why. */
export function ImportReportScreen() {
  const { t } = useI18n();
  const id = useParams()['id'] ?? '';
  const load = useCallback(() => fetchImport(id), [id]);
  const { state } = useQuery(load);
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  return <Report key={state.data.id} initial={state.data} />;
}
