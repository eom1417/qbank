import { useState } from 'react';
import type { ItemResponse } from '../../../contracts/study.js';
import { Alert, Button, Card, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from '../identity/session.js';

type Solution = NonNullable<ItemResponse['solution']>;

/** After the answer: right or not, the right answer, and the book's explanation (FR-12-004). */
export function SolutionView({ solution }: { solution: Solution }) {
  const { t } = useI18n();
  const { state } = useSession();
  // The owner's choice (FR-22-001): the book's explanation at once, or only when asked for.
  const mode =
    state.status === 'signed-in' ? state.account.preferences.explanationMode : 'after_answer';
  const [open, setOpen] = useState(mode === 'after_answer');
  return (
    <Stack>
      <Alert tone={solution.correct ? 'success' : 'error'}>
        {t(solution.correct ? 'study.correct' : 'study.wrong')} · {t('study.rightAnswer')}{' '}
        {solution.answers.join(', ')}
      </Alert>
      {solution.explanation === null ? (
        <MutedText>{t('study.explanation.none')}</MutedText>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setOpen(!open)}>
            {t(open ? 'study.explanation.hide' : 'study.explanation.show')}
          </Button>
          {open && (
            <Card>
              <Subtitle>{t('study.explanation.title')}</Subtitle>
              <p dir="auto">{solution.explanation}</p>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
