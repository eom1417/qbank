import { Link } from 'react-router';
import {
  Alert,
  Button,
  Card,
  Heading,
  NarrowColumn,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { EmailField } from './fields.js';
import { GoogleSignIn } from './GoogleSignIn.js';
import { useSession } from './session.js';

/** E-mail and password, or on a Google-only server the Google button (DEC-42). */
export function SignInScreen() {
  const { signInMethod } = useSession();
  return signInMethod === 'google' ? <GoogleSignIn /> : <PasswordSignIn />;
}

/** The e-mail and password form (password servers). */
function PasswordSignIn() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const form = useSubmit((data) =>
    signIn({ email: text(data, 'email'), password: text(data, 'password') }),
  );
  return (
    <NarrowColumn>
      <Heading>{t('auth.signIn.title')}</Heading>
      <Card>
        <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
          {form.error && <Alert tone="error">{t(form.error)}</Alert>}
          <EmailField />
          <TextField
            name="password"
            type="password"
            autoComplete="current-password"
            required
            label={t('auth.field.password')}
          />
          <Button type="submit" busy={form.busy}>
            {t('auth.signIn.submit')}
          </Button>
        </form>
      </Card>
      <Link to="/forgot-password">{t('auth.signIn.forgot')}</Link>
      <Link to="/sign-up">{t('auth.signIn.toSignUp')}</Link>
    </NarrowColumn>
  );
}
