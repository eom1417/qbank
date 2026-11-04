import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { BulkApproveResponse, ReviewItem } from '../../../contracts/review.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Heading,
  MutedText,
  SelectField,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { approveSafe, fetchQueue } from './api.js';
import { reasonLabel } from './labels.js';
import { ReviewItemCard } from './ReviewItemCard.js';

/** Safe bulk approval (FR-09-006): conflicts and missing parts are never approved this way. */
function ApproveSafeCard({ bankId, onDone }: { bankId: string; onDone(): void }) {
  const { t } = useI18n();
  const [result, setResult] = useState<BulkApproveResponse | null>(null);
  const run = useAction(async () => {
    setResult(await approveSafe(bankId));
    onDone();
  });
  return (
    <Card>
      <Stack>
        <MutedText>{t('review.approveSafe.hint')}</MutedText>
        <Button busy={run.busy} onClick={() => void run.run()}>
          {t('review.approveSafe')}
        </Button>
        {result && (
          <Alert tone="success">
            {t('review.approveSafe.approved')} {result.approved} · {t('review.approveSafe.kept')}{' '}
            {result.keptForReview}
          </Alert>
        )}
        {run.error && <Alert tone="error">{t(run.error)}</Alert>}
      </Stack>
    </Card>
  );
}

function reasonsIn(items: readonly ReviewItem[]) {
  return [...new Set(items.flatMap((item) => item.reasons))].sort();
}

/** The bank's review queue (UI-10, FR-09-001): worst first, filtered by problem. */
export function ReviewScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const load = useCallback(() => fetchQueue(bankId), [bankId]);
  const { state, reload } = useQuery(load);
  const [reason, setReason] = useState('');
  const items = state.status === 'ready' ? state.data.items : [];
  const shown = reason ? items.filter((item) => item.reasons.includes(reason)) : items;
  const options = [
    { value: '', label: t('review.filter.all') },
    ...reasonsIn(items).map((r) => ({ value: r, label: reasonLabel(t, r) })),
  ];
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('review.title')}</Heading>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && items.length === 0 && (
        <EmptyState title={t('review.empty')} description={t('review.approveSafe.hint')} />
      )}
      {items.length > 0 && (
        <>
          <ApproveSafeCard bankId={bankId} onDone={reload} />
          <SelectField
            label={t('review.filter')}
            value={reason}
            options={options}
            onChange={(e) => setReason(e.target.value)}
          />
          <MutedText>
            {t('review.count')} {shown.length}
          </MutedText>
          {shown.map((item) => (
            <ReviewItemCard key={item.id} item={item} onDecided={reload} />
          ))}
        </>
      )}
    </Stack>
  );
}
