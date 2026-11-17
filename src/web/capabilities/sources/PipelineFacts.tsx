import type { ImportResponse } from '../../../contracts/sources.js';
import { Alert, MutedText } from '../../design-system/index.js';
import { en } from '../../platform/i18n/catalog-en.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

const known = (key: string): key is MessageKey => key in en;

/** A code's words when the catalog has them; an unknown code (a newer server) as it is. */
function said(t: (key: MessageKey) => string, prefix: string, code: string) {
  const key = `${prefix}.${code}`;
  return known(key) ? t(key) : code;
}

/**
 * What a pipeline import learnt of its file (M34 P6): the tier it started with, the document
 * type and whether it has been measured (Q59), pages of unknown shape, and review by reason.
 */
export function PipelineFacts({ job }: { job: ImportResponse }) {
  const { t } = useI18n();
  const facts = job.ai?.pipeline;
  if (!facts) return null;
  return (
    <>
      {job.ai?.tier && (
        <MutedText>
          {t('import.report.tier')}: {t(`import.tier.${job.ai.tier}`)}
        </MutedText>
      )}
      {facts.family && (
        <MutedText>
          {t('import.report.family')}: {said(t, 'import.family', facts.family)}
        </MutedText>
      )}
      {!facts.measured && <Alert tone="info">{t('import.report.unmeasured')}</Alert>}
      {facts.unknownPages.length > 0 && (
        <MutedText>
          {t('import.report.unknownPages')}: <bdi>{facts.unknownPages.join(', ')}</bdi>
        </MutedText>
      )}
      {facts.reviewReasons.length > 0 && (
        <ul className="qb-list" aria-label={t('import.report.reasons')}>
          {facts.reviewReasons.map((row) => (
            <li key={row.reason} className="qb-list__item">
              {said(t, 'review.reason', row.reason)}: {row.count}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
