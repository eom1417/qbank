import { Heading, NarrowColumn } from '../design-system/index.js';
import { AccountSettings } from '../capabilities/identity/AccountSettings.js';
import { TagsCard } from '../capabilities/library/TagsCard.js';
import { useI18n } from '../platform/i18n/i18n.js';

/** Settings page: composes the identity and library capabilities' own cards. */
export function SettingsPage() {
  const { t } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t('settings.title')}</Heading>
      <AccountSettings />
      <TagsCard />
    </NarrowColumn>
  );
}
