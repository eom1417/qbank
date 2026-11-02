import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  Alert,
  Button,
  Card,
  Heading,
  MutedText,
  NarrowColumn,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { EmailField } from './fields.js';

/** Asks for a reset link. The answer never reveals whether the e-mail has an account. */
export function ForgotPasswordScreen() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const form = useSubmit(async (data) => {
    await apiRequest('POST', '/api/auth/password-reset/request', z.null(), {
      email: text(data, 'email'),
    });
    setSent(true);
  });
  return (
    <NarrowColumn>
      <Heading>{t('auth.forgot.title')}</Heading>
      <MutedText>{t('auth.forgot.intro')}</MutedText>
      <Card>
        {sent ? (
          <Alert tone="success">{t('auth.forgot.sent')}</Alert>
        ) : (
          <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
            {form.error && <Alert tone="error">{t(form.error)}</Alert>}
            <EmailField />
            <Button type="submit" busy={form.busy}>
              {t('auth.forgot.submit')}
            </Button>
          </form>
        )}
      </Card>
      <Link to="/sign-in">{t('auth.signUp.toSignIn')}</Link>
    </NarrowColumn>
  );
}
