import { useState, type ReactNode } from 'react';
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
  Stack,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { EmailField } from './fields.js';
import { GoogleButton, GoogleErrorAlert } from './GoogleButton.js';
import { OperatorLine } from './OperatorLine.js';
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

/** What every sign-up shows around its form: who runs the site, the terms and the way back. */
function SignUpFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t('auth.signUp.title')}</Heading>
      <MutedText>{t('auth.signUp.intro')}</MutedText>
      <OperatorLine />
      <Card>{children}</Card>
      <Row>
        <Link to="/terms">{t('auth.signUp.readTerms')}</Link>
        <Link to="/privacy">{t('auth.signUp.readPrivacy')}</Link>
      </Row>
      <Link to="/sign-in">{t('auth.signUp.toSignIn')}</Link>
    </NarrowColumn>
  );
}

/** Google-only server (DEC-42): the button stays off until the terms are accepted. */
function GoogleSignUp() {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState(false);
  return (
    <SignUpFrame>
      <Stack>
        <GoogleErrorAlert />
        <MutedText>{t('auth.google.signUpHint')}</MutedText>
        <Checkbox
          name="acceptTerms"
          label={t('auth.field.terms')}
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <GoogleButton acceptTerms disabled={!accepted} />
      </Stack>
    </SignUpFrame>
  );
}

/** E-mail and password, or on a Google-only server the Google button (DEC-42). */
export function SignUpScreen() {
  const { signInMethod } = useSession();
  return signInMethod === 'google' ? <GoogleSignUp /> : <PasswordSignUp />;
}

/** The e-mail and password form (password servers). */
function PasswordSignUp() {
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
    <SignUpFrame>
      <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
        {form.error && <Alert tone="error">{t(form.error)}</Alert>}
        <SignUpFields fieldError={fieldError} />
        <Button type="submit" busy={form.busy}>
          {t('auth.signUp.submit')}
        </Button>
      </form>
    </SignUpFrame>
  );
}
