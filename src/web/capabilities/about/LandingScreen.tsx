import { Link } from 'react-router';
import {
  buttonClass,
  Card,
  Heading,
  MutedText,
  NarrowColumn,
  Row,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** What the service does and does not do, for visitors (UI-01, FR-02-001). No private data here. */
export function LandingScreen() {
  const { t } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t('landing.title')}</Heading>
      <p>{t('landing.lead')}</p>
      <Card>
        <ul className="qb-steps">
          <li>{t('landing.point1')}</li>
          <li>{t('landing.point2')}</li>
          <li>{t('landing.point3')}</li>
        </ul>
        <MutedText>{t('landing.notDoing')}</MutedText>
      </Card>
      <Row>
        <Link className={buttonClass()} to="/sign-up">
          {t('landing.cta')}
        </Link>
        <Link to="/sign-in">{t('landing.signIn')}</Link>
      </Row>
      <Row>
        <Link to="/terms">{t('legal.terms.title')}</Link>
        <Link to="/privacy">{t('legal.privacy.title')}</Link>
      </Row>
    </NarrowColumn>
  );
}
