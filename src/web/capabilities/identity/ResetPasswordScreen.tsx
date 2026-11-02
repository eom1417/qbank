import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';
import {
  Alert,
  Button,
  Card,
  Heading,
  NarrowColumn,
  TextField,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The token arrives in the URL fragment, so it never reaches server logs or Referer headers. */
const tokenFromHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).get('token');

export function ResetPasswordScreen() {
  const { t } = useI18n();
  const token = tokenFromHash(useLocation().hash);
  const [done, setDone] = useState(false);
  const form = useSubmit(async (data) => {
    const body = { token, password: text(data, 'password') };
    await apiRequest('POST', '/api/auth/password-reset/confirm', z.null(), body);
    setDone(true);
  });
  const passwordError = form.fieldErrors['password'];
  return (
    <NarrowColumn>
      <Heading>{t('auth.reset.title')}</Heading>
      <Card>
        {!token && <Alert tone="error">{t('auth.reset.missingToken')}</Alert>}
        {done && <Alert tone="success">{t('auth.reset.done')}</Alert>}
        {token && !done && (
          <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
            {form.error && <Alert tone="error">{t(form.error)}</Alert>}
            <TextField
              name="password"
              type="password"
              autoComplete="new-password"
              required
              label={t('settings.password.new')}
              hint={t('auth.field.passwordHint')}
              error={passwordError && t(passwordError)}
            />
            <Button type="submit" busy={form.busy}>
              {t('auth.reset.submit')}
            </Button>
          </form>
        )}
      </Card>
      <Link to={done ? '/sign-in' : '/forgot-password'}>
        {t(done ? 'shell.nav.signIn' : 'auth.forgot.title')}
      </Link>
    </NarrowColumn>
  );
}
