import type { ReactNode } from 'react';
import { Button, Row } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

interface ExamMovesProps {
  position: number;
  /** Whether the question is flagged; null when flagging is not allowed. */
  flagged: boolean | null;
  onFlag(): void;
  canPrevious: boolean;
  canNext: boolean;
  onGo(position: number): void;
  /** The way to the check before submitting. */
  check: ReactNode;
}

/** Flag, previous and next as the rules allow, and the way to the check. */
export function ExamMoves({
  position,
  flagged,
  onFlag,
  canPrevious,
  canNext,
  onGo,
  check,
}: ExamMovesProps) {
  const { t } = useI18n();
  return (
    <Row>
      {flagged !== null && (
        <Button variant="ghost" onClick={onFlag}>
          {t(flagged ? 'exam.unflag' : 'exam.flag')}
        </Button>
      )}
      <Button variant="secondary" disabled={!canPrevious} onClick={() => onGo(position - 1)}>
        {t('exam.previous')}
      </Button>
      <Button variant="secondary" disabled={!canNext} onClick={() => onGo(position + 1)}>
        {t('exam.next')}
      </Button>
      {check}
    </Row>
  );
}
