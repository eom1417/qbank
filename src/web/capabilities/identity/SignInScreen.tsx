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
import { useSession } from './session.js';

export function SignInScreen() {
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
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            required
            label={t('auth.field.email')}
          />
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
      <Link to="/sign-up">{t('auth.signIn.toSignUp')}</Link>
    </NarrowColumn>
  );
}
