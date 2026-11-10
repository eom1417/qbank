import { Link } from 'react-router';
import { MutedText, Row } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useOperatorFill } from './mode-copy.js';
import { useSession } from './session.js';

/** Who runs this server and a link to what that means for your data (M31, B3). */
export function OperatorLine() {
  const { t } = useI18n();
  const { operatorName } = useSession();
  const withOperator = useOperatorFill();
  if (!operatorName) return null;
  return (
    <Row>
      <MutedText>{withOperator(t('auth.signUp.operator'))}</MutedText>
      <Link to="/help#privacy">{t('auth.signUp.whereData')}</Link>
    </Row>
  );
}
