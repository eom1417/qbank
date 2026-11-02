import { Alert, Card, Heading, NarrowColumn, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { LEGAL } from '../../platform/i18n/legal-content.js';

/** Terms of use or privacy policy, in the interface language (FR-20-005..007). */
export function LegalScreen({ page }: { page: 'terms' | 'privacy' }) {
  const { t, locale } = useI18n();
  return (
    <NarrowColumn>
      <Heading>{t(page === 'terms' ? 'legal.terms.title' : 'legal.privacy.title')}</Heading>
      <Alert tone="info">{t('legal.draft')}</Alert>
      {LEGAL[locale][page].map((section) => (
        <Card key={section.heading}>
          <Subtitle>{section.heading}</Subtitle>
          <p>{section.body}</p>
        </Card>
      ))}
    </NarrowColumn>
  );
}
