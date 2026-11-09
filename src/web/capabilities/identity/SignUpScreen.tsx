import { Link } from 'react-router';
import type { SignUpRequest } from '../../../contracts/identity.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Heading,
  MutedText,
  NarrowColumn,
  Row,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { EmailField } from './fields.js';
import { useOperatorFill } from './mode-copy.js';
import { useSession } from './session.js';

function SignUpFields({ fieldError }: { fieldError(name: string): string | undefined }) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        name="displayName"
        autoComplete="name"
        required
        label={t('auth.field.displayName')}
        error={fieldError('displayName')}
      />
      <EmailField error={fieldError('email')} />
      <TextField
        name="password"
        type="password"
        autoComplete="new-password"
        required
        label={t('auth.field.password')}
        hint={t('auth.field.passwordHint')}
        error={fieldError('password')}
      />
      <Checkbox
        name="acceptTerms"
        label={t('auth.field.terms')}
        error={fieldError('acceptTerms')}
      />
    </>
  );
}

/** Who runs this server and a link to what that means for your data (M31, B3). */
function OperatorLine() {
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

export function SignUpScreen() {
  const { t, locale } = useI18n();
  const { signUp } = useSession();
  const form = useSubmit((data) =>
    signUp({
      email: text(data, 'email'),
      password: text(data, 'password'),
      displayName: text(data, 'displayName'),
      locale,
      // Sent as-is so the server, not the browser, enforces consent.
      acceptTerms: (data.get('acceptTerms') === 'on') as SignUpRequest['acceptTerms'],
    }),
  );
  const fieldError = (name: string) => {
    const key = form.fieldErrors[name];
    return key && t(key);
  };
  return (
    <NarrowColumn>
      <Heading>{t('auth.signUp.title')}</Heading>
      <MutedText>{t('auth.signUp.intro')}</MutedText>
      <OperatorLine />
      <Card>
        <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
          {form.error && <Alert tone="error">{t(form.error)}</Alert>}
          <SignUpFields fieldError={fieldError} />
          <Button type="submit" busy={form.busy}>
            {t('auth.signUp.submit')}
          </Button>
        </form>
      </Card>
      <Row>
        <Link to="/terms">{t('auth.signUp.readTerms')}</Link>
        <Link to="/privacy">{t('auth.signUp.readPrivacy')}</Link>
      </Row>
      <Link to="/sign-in">{t('auth.signUp.toSignIn')}</Link>
    </NarrowColumn>
  );
}
