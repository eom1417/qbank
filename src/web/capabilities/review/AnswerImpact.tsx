import { useEffect, useState } from 'react';
import type { AnswerImpactResponse } from '../../../contracts/study.js';
import { Alert } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchAnswerImpact } from '../study/api.js';

/**
 * Before a changed key is saved, what it means for past answers (UI-11, FR-07-007, JY-15): how
 * many there are, and how many would differ; they keep the result they were graded with.
 */
export function AnswerImpact({
  questionId,
  answers,
  changed,
}: {
  questionId: string;
  answers: readonly string[];
  changed: boolean;
}) {
  const { t } = useI18n();
  const [impact, setImpact] = useState<AnswerImpactResponse | null>(null);
  const key = answers.join(',');
  useEffect(() => {
    let active = true;
    if (changed && key !== '')
      fetchAnswerImpact(questionId, key.split(',')).then(
        (r) => active && setImpact(r),
        () => undefined,
      );
    return () => {
      active = false;
    };
  }, [questionId, key, changed]);
  if (!changed || !impact || impact.attempts === 0) return null;
  return (
    <Alert tone="info">
      {t('exam.impact')} {impact.attempts} {t('exam.impact.attempts')} {impact.sessions}{' '}
      {t('exam.impact.sessions')}. {impact.wouldChange} {t('exam.impact.change')}
    </Alert>
  );
}
