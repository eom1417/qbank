import { useState } from 'react';
import { Alert, Button, Card, MutedText, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

interface AnswerVerdictProps {
  correct: boolean;
  answers: readonly string[];
  explanation: string | null;
  /** The explanation shown at once, or only when asked for. */
  startOpen: boolean;
  /** Said when there is no explanation; null says nothing. */
  emptyText: string | null;
}

/** After the answer: right or not, the right answer, and the explanation (FR-12-004). */
export function AnswerVerdict({
  correct,
  answers,
  explanation,
  startOpen,
  emptyText,
}: AnswerVerdictProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <Alert tone={correct ? 'success' : 'error'}>
        {t(correct ? 'study.correct' : 'study.wrong')} · {t('study.rightAnswer')}{' '}
        {answers.join(', ')}
      </Alert>
      {explanation === null ? (
        emptyText !== null && <MutedText>{emptyText}</MutedText>
      ) : (
        <>
          <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t(open ? 'study.explanation.hide' : 'study.explanation.show')}
          </Button>
          {open && (
            <Card>
              <Subtitle>{t('study.explanation.title')}</Subtitle>
              <p dir="auto">{explanation}</p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
