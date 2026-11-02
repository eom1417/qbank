import { TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The account e-mail input, identical on sign-in, sign-up and password reset. */
export function EmailField({ error }: { error?: string | undefined }) {
  const { t } = useI18n();
  return (
    <TextField
      name="email"
      type="email"
      autoComplete="email"
      required
      label={t('auth.field.email')}
      error={error}
    />
  );
}
