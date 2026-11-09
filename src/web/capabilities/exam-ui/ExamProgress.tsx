import { MutedText, Row } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { ExamClock } from './ExamClock.js';

interface ExamProgressProps {
  position: number;
  total: number;
  /** The server's last word on the time left; null when untimed. */
  secondsLeft: number | null;
  onZero(): void;
}

/** Which question of how many, and the clock beside it. */
export function ExamProgress({ position, total, secondsLeft, onZero }: ExamProgressProps) {
  const { t } = useI18n();
  return (
    <Row>
      <MutedText>
        {t('exam.question')} {position + 1} {t('exam.of')} {total}
      </MutedText>
      {/* A new value from the server, or a new question, starts the clock again from there. */}
      <ExamClock key={`${position}:${secondsLeft}`} seconds={secondsLeft} onZero={onZero} />
    </Row>
  );
}
