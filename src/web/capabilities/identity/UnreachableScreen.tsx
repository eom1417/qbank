import { Button, Card, Heading, NarrowColumn } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

/**
 * The QBank server did not answer the first request. Said plainly, instead of a sign-in screen
 * that cannot work; the session retries by itself and on demand.
 */
export function UnreachableScreen() {
  const { t } = useI18n();
  const { retry } = useSession();
  return (
    <NarrowColumn>
      <Heading>{t('session.unreachable.title')}</Heading>
      <Card>
        <div className="qb-stack">
          <p>{t('session.unreachable.lead')}</p>
          <Button onClick={retry}>{t('session.unreachable.retry')}</Button>
        </div>
      </Card>
    </NarrowColumn>
  );
}
