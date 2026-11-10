import { useLocation } from 'react-router';
import { Alert, Button } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { googleError, googleStartUrl, safeNext } from './google.js';

/**
 * «Continue with Google» (DEC-42): a full-page move to the server's start route, never a fetch,
 * since Google's pages must open in the browser itself. Sign-up keeps it off until the terms
 * are accepted, and then sends that acceptance along.
 */
export function GoogleButton({
  acceptTerms,
  disabled,
}: {
  acceptTerms: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { search } = useLocation();
  const next = safeNext(new URLSearchParams(search).get('next'));
  return (
    <Button
      disabled={disabled}
      onClick={() => window.location.assign(googleStartUrl(next, acceptTerms))}
    >
      {t('auth.google.continue')}
    </Button>
  );
}

/** Why the server sent the browser back here: Google failed, or the terms were not accepted. */
export function GoogleErrorAlert() {
  const { t } = useI18n();
  const error = googleError(useLocation().search);
  if (!error) return null;
  return <Alert tone="error">{t(`auth.google.error.${error}`)}</Alert>;
}
