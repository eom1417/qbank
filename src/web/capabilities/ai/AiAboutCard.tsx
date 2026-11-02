import type { ProviderKind } from '../../../contracts/ai.js';
import { Alert, Card, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/**
 * What an AI task sends, and to whom (FR-20-003). No privacy promise is made on behalf of an
 * external provider. Shown in settings and, from M4, before an upload that uses AI.
 */
export function DisclosureNote({ kind }: { kind: ProviderKind }) {
  const { t } = useI18n();
  return (
    <Alert tone="info">
      <Stack>
        <p>{t('ai.disclosure.body')}</p>
        <p>{t(kind === 'local' ? 'ai.disclosure.local' : 'ai.disclosure.external')}</p>
      </Stack>
    </Alert>
  );
}

const NEEDS_AI = ['ai.needs.reading', 'ai.needs.explain', 'ai.needs.suggest'] as const;

/** Working without a key (FR-08-013): says plainly what works now and what needs AI. */
export function AiAboutCard({ hasProvider }: { hasProvider: boolean }) {
  const { t } = useI18n();
  return (
    <Card>
      {!hasProvider && (
        <Alert tone="info">
          <Stack>
            <strong>{t('ai.none.title')}</strong>
            <p>{t('ai.none.body')}</p>
          </Stack>
        </Alert>
      )}
      <Subtitle>{t('ai.needs.title')}</Subtitle>
      <ul className="qb-steps">
        {NEEDS_AI.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <Subtitle>{t('ai.disclosure.title')}</Subtitle>
      <MutedText>{t('ai.disclosure.body')}</MutedText>
      <ul className="qb-steps">
        <li>{t('ai.disclosure.local')}</li>
        <li>{t('ai.disclosure.external')}</li>
      </ul>
    </Card>
  );
}
