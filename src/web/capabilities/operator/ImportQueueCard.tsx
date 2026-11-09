import type { QueueItem } from '../../../contracts/operator.js';
import { Badge, MutedText, Row } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { fetchQueue } from './api.js';
import { OperatorCard, useWhen } from './OperatorCard.js';
import { queueOrder } from './view.js';

function QueueRow({ item }: { item: QueueItem }) {
  const { t } = useI18n();
  const when = useWhen();
  return (
    <li className="qb-list__item">
      <Row>
        <bdi className="qb-grow">{item.accountEmail}</bdi>
        <Badge>{t(`operator.queue.${item.state}`)}</Badge>
      </Row>
      <MutedText>
        {fill(t('operator.queue.pages'), { done: item.pagesDone, total: item.pagesTotal })} ·{' '}
        {fill(t('operator.queue.since'), { when: when(item.since) })}
      </MutedText>
    </li>
  );
}

/** Imports across all accounts: who and how big, never the file or its questions. */
export function ImportQueueCard() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchQueue);
  return (
    <OperatorCard title={t('operator.queue.title')} state={state} onRefresh={reload}>
      {(data) => (
        <>
          <MutedText>{fill(t('operator.queue.workers'), { n: data.workers })}</MutedText>
          {data.items.length === 0 ? (
            <MutedText>{t('operator.queue.empty')}</MutedText>
          ) : (
            <ul className="qb-list">
              {queueOrder(data.items).map((item) => (
                <QueueRow key={item.jobId} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </OperatorCard>
  );
}
