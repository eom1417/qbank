import { Link } from 'react-router';
import { Card, Heading, NarrowColumn, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { GoogleButton, GoogleErrorAlert } from './GoogleButton.js';
import { OperatorLine } from './OperatorLine.js';

/** Google-only server (DEC-42): one button, no password and no "forgot password". */
export function GoogleSignIn() {
  const { t } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t('auth.signIn.title')}</Heading>
      <OperatorLine />
      <Card>
        <Stack>
          <GoogleErrorAlert />
          <GoogleButton acceptTerms={false} />
        </Stack>
      </Card>
      <Link to="/sign-up">{t('auth.signIn.toSignUp')}</Link>
    </NarrowColumn>
  );
}
