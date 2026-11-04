import { Link } from 'react-router';
import { Button, buttonClass, EmptyState, PageShell, Row } from '../design-system/index.js';
import { useI18n } from '../platform/i18n/i18n.js';

/** A screen that failed never leaves a blank page: it says so and offers a way out (FR-23-009). */
export function RouteError() {
  const { t } = useI18n();
  return (
    <PageShell brand="QBank" actions={null}>
      <EmptyState
        title={t('error.screen.title')}
        description={t('error.screen.body')}
        action={
          <Row>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('error.screen.reload')}
            </Button>
            <Link className={buttonClass('primary')} to="/">
              {t('error.screen.home')}
            </Link>
          </Row>
        }
      />
    </PageShell>
  );
}
