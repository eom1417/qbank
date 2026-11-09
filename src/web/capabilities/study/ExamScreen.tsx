import { Link, useParams, useSearchParams } from 'react-router';
import type { ItemResponse } from '../../../contracts/study.js';
import { buttonClass, MutedText, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { ExamMap } from '../exam-ui/ExamMap.js';
import { ExamMoves } from '../exam-ui/ExamMoves.js';
import { ExamProgress } from '../exam-ui/ExamProgress.js';
import { QuestionCard } from '../exam-ui/QuestionCard.js';
import { SaveState } from '../exam-ui/SaveState.js';
import { useExam } from './use-exam.js';

/** The question with no hint of its answer: no marks, no explanation (FR-13-006, UAT-051). */
function ExamQuestion({
  item,
  onChoose,
}: {
  item: ItemResponse;
  onChoose(chosen: string[]): void;
}) {
  const { t } = useI18n();
  const choices = item.options.map((o) => ({ value: o.letter, label: `${o.label} ${o.text}` }));
  return (
    <QuestionCard
      question={item}
      pictureUrl={(id) => `/api/media/${id}`}
      choices={choices}
      selected={item.saved}
      disabled={!item.changeable}
      onChoose={onChoose}
    >
      {!item.changeable && <MutedText>{t('exam.locked')}</MutedText>}
    </QuestionCard>
  );
}

/** An exam (UI-17, JY-08, JY-09): answer, flag, move as allowed, then check and submit. */
export function ExamScreen() {
  const { t } = useI18n();
  const sessionId = useParams()['id'] ?? '';
  const at = useSearchParams()[0].get('at');
  const exam = useExam(sessionId, at === null ? null : Number(at));
  const { state, item } = exam;
  if (!state || !item) return <MutedText>{t('common.loading')}</MutedText>;
  const perQuestion = state.timing === 'per_question';
  const atEnd = item.position >= item.total - 1;
  const onZero = () => void (perQuestion && !atEnd ? exam.go(item.position + 1) : exam.refresh());
  return (
    <Stack>
      <ExamProgress
        position={item.position}
        total={item.total}
        secondsLeft={state.secondsLeft}
        onZero={onZero}
      />
      <ExamQuestion item={item} onChoose={(chosen) => void exam.choose(chosen)} />
      <SaveState status={exam.saving} />
      <ExamMoves
        position={item.position}
        flagged={item.examFlag}
        onFlag={() => void exam.toggleFlag()}
        canPrevious={!perQuestion && item.position > 0}
        canNext={!atEnd}
        onGo={(p) => void exam.go(p)}
        check={
          <Link className={buttonClass()} to={`/exam/sessions/${sessionId}/check`}>
            {t('exam.check')}
          </Link>
        }
      />
      <ExamMap
        items={state.items}
        current={state.position}
        canGo={(i) => i.changeable || !perQuestion}
        onGo={(p) => void exam.go(p)}
      />
    </Stack>
  );
}
