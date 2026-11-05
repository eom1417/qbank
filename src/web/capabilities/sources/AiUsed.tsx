import type { ImportResponse } from '../../../contracts/sources.js';
import { MutedText } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** Which model played each triage role in this job, and whether it improved the questions. */
export function AiUsed({ ai }: { ai: ImportResponse['ai'] }) {
  const { t } = useI18n();
  if (!ai) return null;
  const name = (model: string | undefined) => (
    <bdi>{model ?? ai.model ?? t('ai.model.default')}</bdi>
  );
  return (
    <MutedText>
      {t('triage.role.solvers')}: {name(ai.models.first)} + {name(ai.models.second)} ·{' '}
      {t('triage.role.judge')}: {name(ai.models.judge)} ·{' '}
      {ai.improve ? (
        <>
          {t('triage.role.improver')}: {name(ai.models.improver)}
        </>
      ) : (
        t('triage.improve.off')
      )}
    </MutedText>
  );
}
