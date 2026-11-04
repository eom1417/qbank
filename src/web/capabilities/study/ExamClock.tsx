import { useEffect, useState } from 'react';
import { MutedText } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/**
 * The time left, as the server last said, counted down here. At zero the server is asked again:
 * it alone decides that the time is over (FR-13-011). Untimed exams show no clock (UAT-048).
 */
export function ExamClock({ seconds, onZero }: { seconds: number | null; onZero(): void }) {
  const { t } = useI18n();
  // A new value from the server remounts the clock (its key), so it starts again from there.
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) return onZero();
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onZero]);
  if (left === null) return null;
  return (
    <MutedText>
      {t('exam.timeLeft')} <span role="timer">{left}</span>
    </MutedText>
  );
}
