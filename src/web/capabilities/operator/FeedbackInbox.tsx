import type { FeedbackItem, FeedbackListResponse } from '../../../contracts/operator.js';
import { Alert, Button, MutedText } from '../../design-system/index.js';
import type { QueryState } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { closeFeedback } from './api.js';
import { OperatorCard, useWhen } from './OperatorCard.js';
import { openFeedback } from './view.js';

function FeedbackRow({ item, onClosed }: { item: FeedbackItem; onClosed(): void }) {
  const { t } = useI18n();
  const when = useWhen();
  const close = useAction(async () => {
    await closeFeedback(item.id);
    onClosed();
  });
  return (
    <li className="qb-list__item">
      <MutedText>
        <bdi>
          {fill(t('operator.feedback.meta'), {
            name: item.accountName,
            email: item.accountEmail,
            when: when(item.createdAt),
          })}
        </bdi>
      </MutedText>
      <p className="qb-pre" dir="auto">
        {item.message}
      </p>
      <MutedText>
        {fill(t('operator.feedback.where'), {
          screen: item.screen || '-',
          version: item.version,
        })}
      </MutedText>
      {close.error && <Alert tone="error">{t(close.error)}</Alert>}
      <Button variant="secondary" busy={close.busy} onClick={() => void close.run()}>
        {t('operator.feedback.close')}
      </Button>
    </li>
  );
}

interface Props {
  state: QueryState<FeedbackListResponse>;
  reload(): void;
}

/** Open notes from the site's users, newest first; each is closed once handled. */
export function FeedbackInbox({ state, reload }: Props) {
  const { t } = useI18n();
  return (
    <OperatorCard title={t('operator.feedback.title')} state={state} onRefresh={reload}>
      {(data) => {
        const items = openFeedback(data.items);
        if (items.length === 0) return <MutedText>{t('operator.feedback.empty')}</MutedText>;
        return (
          <ul className="qb-list">
            {items.map((item) => (
              <FeedbackRow key={item.id} item={item} onClosed={reload} />
            ))}
          </ul>
        );
      }}
    </OperatorCard>
  );
}
