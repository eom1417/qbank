import type { ItemResponse } from '../../../contracts/study.js';
import { Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { AnswerVerdict } from '../exam-ui/AnswerVerdict.js';
import { useSession } from '../identity/session.js';
import { StudyNoteCard } from '../review/StudyNoteCard.js';

type Solution = NonNullable<ItemResponse['solution']>;

/** After the answer: right or not, the right answer, and the book's explanation (FR-12-004). */
export function SolutionView({ solution }: { solution: Solution }) {
  const { t } = useI18n();
  const { state } = useSession();
  // The owner's choice (FR-22-001): the book's explanation at once, or only when asked for.
  const mode =
    state.status === 'signed-in' ? state.account.preferences.explanationMode : 'after_answer';
  return (
    <Stack>
      <AnswerVerdict
        correct={solution.correct}
        answers={solution.answers}
        explanation={solution.explanation}
        startOpen={mode === 'after_answer'}
        emptyText={t('study.explanation.none')}
      />
      <StudyNoteCard note={solution.studyNote} />
    </Stack>
  );
}
