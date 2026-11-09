import { Alert, Card, Heading, NarrowColumn, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { legalSections } from '../../platform/i18n/legal-content.js';
import { useOperatorFill } from '../identity/mode-copy.js';
import { useSession } from '../identity/session.js';

/**
 * Terms of use or privacy policy, in the interface language (FR-20-005..007); a server shows its
 * own privacy page, naming who runs it (M31, B3, DEC-40).
 */
export function LegalScreen({ page }: { page: 'terms' | 'privacy' }) {
  const { t, locale } = useI18n();
  const { mode } = useSession();
  const withOperator = useOperatorFill();
  return (
    <NarrowColumn>
      <Heading>{t(page === 'terms' ? 'legal.terms.title' : 'legal.privacy.title')}</Heading>
      <Alert tone="info">{t('legal.draft')}</Alert>
      {legalSections(locale, page, mode).map((section) => (
        <Card key={section.heading}>
          <Subtitle>{section.heading}</Subtitle>
          <p>{withOperator(section.body)}</p>
        </Card>
      ))}
    </NarrowColumn>
  );
}
