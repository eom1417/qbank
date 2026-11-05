import type { Enhancements, ImportResponse } from '../../../contracts/sources.js';
import { MutedText } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

/** The improvements a job made, in words (DEC-34). */
function chosen(enhance: Enhancements, t: (key: MessageKey) => string) {
  const switches = (Object.keys(enhance) as (keyof Enhancements)[]).filter(
    (key) => key !== 'completeOptions' && enhance[key] === true,
  );
  const count = enhance.completeOptions;
  return [
    ...(count > 0 ? [`${t('enhance.completeOptions.to')} ${count}`] : []),
    ...switches.map((key) => t(`enhance.${key}` as MessageKey)),
  ];
}

/** Which model played each role in this job, and what it improved. */
export function AiUsed({ ai }: { ai: ImportResponse['ai'] }) {
  const { t } = useI18n();
  if (!ai) return null;
  const name = (model: string | undefined) => (
    <bdi>{model ?? ai.model ?? t('ai.model.default')}</bdi>
  );
  const improvements = chosen(ai.enhance, t);
  return (
    <>
      <MutedText>
        {t('triage.role.improver')}: {name(ai.models.improver)} · {t('triage.role.solvers')}:{' '}
        {name(ai.models.first)} + {name(ai.models.second)} · {t('triage.role.judge')}:{' '}
        {name(ai.models.judge)}
      </MutedText>
      <MutedText>
        {t('enhance.title')}: {improvements.length > 0 ? improvements.join('، ') : '—'}
      </MutedText>
    </>
  );
}
