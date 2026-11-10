import { z } from 'zod';
import type { AccountPreferences } from '../../../contracts/identity.js';
import {
  Button,
  Card,
  MutedText,
  SelectField,
  Stack,
  Subtitle,
  TextField,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { text } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { SettingsForm, useAccountForm, useSavedForm } from './settings-form.js';
import { useSession } from './session.js';
import { SkinCard } from './SkinCard.js';

const STUDY_DEFAULTS = { defaultSessionSize: 20, explanationMode: 'after_answer' } as const;

function ProfileCard({ displayName }: { displayName: string }) {
  const { t } = useI18n();
  const form = useAccountForm((data) => ({ displayName: text(data, 'displayName') }));
  const error = form.fieldErrors['displayName'];
  return (
    <SettingsForm title="settings.profile.title" form={form}>
      <TextField
        name="displayName"
        required
        label={t('auth.field.displayName')}
        defaultValue={displayName}
        error={error && t(error)}
      />
    </SettingsForm>
  );
}

function AppearanceCard({ preferences }: { preferences: AccountPreferences }) {
  const { t } = useI18n();
  const form = useAccountForm((data) => ({
    locale: text(data, 'locale') as AccountPreferences['locale'],
    theme: text(data, 'theme') as AccountPreferences['theme'],
  }));
  const themes = (['system', 'light', 'dark'] as const).map((value) => ({
    value,
    label: t(`settings.appearance.theme.${value}`),
  }));
  const languages = [
    { value: 'ar', label: 'العربية' },
    { value: 'en', label: 'English' },
  ];
  return (
    <SettingsForm title="settings.appearance.title" form={form}>
      <SelectField
        name="locale"
        label={t('settings.appearance.language')}
        options={languages}
        defaultValue={preferences.locale}
      />
      <SelectField
        name="theme"
        label={t('settings.appearance.theme')}
        options={themes}
        defaultValue={preferences.theme}
      />
    </SettingsForm>
  );
}

function StudyCard({ preferences }: { preferences: AccountPreferences }) {
  const { t } = useI18n();
  const { updateAccount } = useSession();
  const form = useAccountForm((data) => ({
    defaultSessionSize: Number(text(data, 'defaultSessionSize')),
    explanationMode: text(data, 'explanationMode') as AccountPreferences['explanationMode'],
    reviewReminders: text(data, 'reviewReminders') as AccountPreferences['reviewReminders'],
  }));
  const modes = (['after_answer', 'on_request'] as const).map((value) => ({
    value,
    label: t(`settings.study.explanation.${value}`),
  }));
  // Re-mount when saved values change, so restoring the defaults shows the restored values.
  return (
    <SettingsForm key={JSON.stringify(preferences)} title="settings.study.title" form={form}>
      <TextField
        name="defaultSessionSize"
        type="number"
        min={1}
        max={200}
        defaultValue={preferences.defaultSessionSize}
        label={t('settings.study.sessionSize')}
        error={form.fieldErrors['defaultSessionSize'] && t('field.outOfRange')}
      />
      <SelectField
        name="explanationMode"
        label={t('settings.study.explanation')}
        options={modes}
        defaultValue={preferences.explanationMode}
      />
      <SelectField
        name="reviewReminders"
        label={t('settings.reminders')}
        options={(['off', 'daily', 'weekly'] as const).map((value) => ({
          value,
          label: t(`settings.reminders.${value}`),
        }))}
        defaultValue={preferences.reviewReminders}
      />
      <Button variant="ghost" onClick={() => void updateAccount(STUDY_DEFAULTS)}>
        {t('settings.study.reset')}
      </Button>
    </SettingsForm>
  );
}

function PasswordCard() {
  const { t } = useI18n();
  const form = useSavedForm(async (data) => {
    const body = {
      currentPassword: text(data, 'currentPassword'),
      newPassword: text(data, 'newPassword'),
    };
    await apiRequest('POST', '/api/account/password', z.null(), body);
  });
  const fieldError = (name: string) => {
    const key = form.fieldErrors[name];
    return key && t(key);
  };
  return (
    <SettingsForm
      title="settings.password.title"
      form={form}
      submitLabel="settings.password.submit"
      savedMessage="settings.password.done"
    >
      <TextField
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        label={t('settings.password.current')}
        error={fieldError('currentPassword')}
      />
      <TextField
        name="newPassword"
        type="password"
        autoComplete="new-password"
        label={t('settings.password.new')}
        hint={t('auth.field.passwordHint')}
        error={fieldError('newPassword')}
      />
    </SettingsForm>
  );
}

/** Google-only server (DEC-42): no password to change, only which Google account signs in. */
function GoogleCard({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Subtitle>{t('settings.google.title')}</Subtitle>
        <MutedText>
          {t('settings.google.signedInAs')} <bdi>{email}</bdi>
        </MutedText>
      </Stack>
    </Card>
  );
}

/** Account settings (UI-25): every value is saved on the server, so it follows the user's devices. */
export function AccountSettings() {
  const { state, mode, signInMethod } = useSession();
  if (state.status !== 'signed-in') return null;
  const { account } = state;
  return (
    <>
      <ProfileCard displayName={account.displayName} />
      <SkinCard />
      <AppearanceCard preferences={account.preferences} />
      <StudyCard preferences={account.preferences} />
      {signInMethod === 'google' && <GoogleCard email={account.email} />}
      {mode === 'accounts' && signInMethod !== 'google' && <PasswordCard />}
    </>
  );
}
