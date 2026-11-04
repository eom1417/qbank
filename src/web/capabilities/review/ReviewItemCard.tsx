import { Link } from 'react-router';
import type { ReviewItem } from '../../../contracts/review.js';
import {
  Badge,
  Button,
  buttonClass,
  Card,
  MutedText,
  Row,
  Stack,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { decide } from './api.js';
import { reasonLabel } from './labels.js';

interface Props {
  item: ReviewItem;
  onDecided(): void;
}

/** One question in the queue: where it is, why it waits, and the quick decisions (UI-10). */
export function ReviewItemCard({ item, onDecided }: Props) {
  const { t } = useI18n();
  const act = useAction(async (decision: 'approve' | 'exclude') => {
    await decide(item.id, decision);
    onDecided();
  });
  return (
    <Card>
      <Stack>
        <Row>
          <Badge>{t(`review.severity.${item.severity}`)}</Badge>
          <MutedText>
            {t('review.page')} {item.page} · {t('review.number')} {item.number}
          </MutedText>
          {item.deferred && <Badge>{t('review.deferred')}</Badge>}
        </Row>
        <p>{item.excerpt}</p>
        <Row>
          {item.reasons.map((reason) => (
            <Badge key={reason}>{reasonLabel(t, reason)}</Badge>
          ))}
        </Row>
        {act.error && <MutedText>{t(act.error)}</MutedText>}
        <Row>
          <Link className={buttonClass()} to={`/questions/${item.id}`}>
            {t('review.open')}
          </Link>
          {item.status === 'needs_review' && (
            <Button variant="secondary" busy={act.busy} onClick={() => void act.run('approve')}>
              {t('review.decision.approve')}
            </Button>
          )}
          <Button variant="ghost" busy={act.busy} onClick={() => void act.run('exclude')}>
            {t('review.decision.exclude')}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
