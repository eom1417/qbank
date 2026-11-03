import { Alert, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/**
 * What an AI task sends, and to whom (FR-20-003). No privacy promise is made on behalf of the
 * user's provider. Shown on the providers screen and before an upload that uses AI.
 */
export function DisclosureNote() {
  const { t } = useI18n();
  return (
    <Alert tone="info">
      <Stack>
        <p>{t('ai.disclosure.body')}</p>
        <p>{t('ai.disclosure.external')}</p>
      </Stack>
    </Alert>
  );
}
