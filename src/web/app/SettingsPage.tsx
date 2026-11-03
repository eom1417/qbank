import { Link } from 'react-router';
import { buttonClass, Heading, NarrowColumn } from '../design-system/index.js';
import { AccountSettings } from '../capabilities/identity/AccountSettings.js';
import { TagsCard } from '../capabilities/library/TagsCard.js';
import { useI18n } from '../platform/i18n/i18n.js';

/** Settings page: composes the identity, AI and library capabilities' own cards. */
export function SettingsPage() {
  const { t } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t('settings.title')}</Heading>
      <Link className={buttonClass('secondary')} to="/settings/providers">
        {t('providers.title')}
      </Link>
      <AccountSettings />
      <TagsCard />
    </NarrowColumn>
  );
}
