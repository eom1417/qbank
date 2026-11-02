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
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
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
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        label={t('auth.field.email')}
        error={fieldError('email')}
      />
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
      <Card>
        <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
          {form.error && <Alert tone="error">{t(form.error)}</Alert>}
          <SignUpFields fieldError={fieldError} />
          <Button type="submit" busy={form.busy}>
            {t('auth.signUp.submit')}
          </Button>
        </form>
      </Card>
      <Link to="/sign-in">{t('auth.signUp.toSignIn')}</Link>
    </NarrowColumn>
  );
}
