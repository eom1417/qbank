import { Link, useParams, useSearchParams } from 'react-router';
import type { ItemResponse } from '../../../contracts/study.js';
import { Alert, Button, buttonClass, MutedText, Row, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { QuestionCard } from './QuestionBody.js';
import { ExamClock } from './ExamClock.js';
import { ExamMap } from './ExamMap.js';
import { useExam, type SaveStatus } from './use-exam.js';

const SAVE_TEXT = { saving: 'exam.saving', saved: 'exam.saved', failed: 'exam.notSaved' } as const;

/** Whether the last choice reached the server: never claims a save it did not confirm. */
function SaveState({ status }: { status: SaveStatus }) {
  const { t } = useI18n();
  if (status === 'idle') return null;
  return status === 'failed' ? (
    <Alert tone="error">{t(SAVE_TEXT.failed)}</Alert>
  ) : (
    <Alert tone="info">{t(SAVE_TEXT[status])}</Alert>
  );
}

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
      item={item}
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
      <Row>
        <MutedText>
          {t('exam.question')} {item.position + 1} {t('exam.of')} {item.total}
        </MutedText>
        <ExamClock
          key={`${item.position}:${state.secondsLeft}`}
          seconds={state.secondsLeft}
          onZero={onZero}
        />
      </Row>
      <ExamQuestion item={item} onChoose={(chosen) => void exam.choose(chosen)} />
      <SaveState status={exam.saving} />
      <Row>
        <Button variant="ghost" onClick={() => void exam.toggleFlag()}>
          {t(item.examFlag ? 'exam.unflag' : 'exam.flag')}
        </Button>
        <Button
          variant="secondary"
          disabled={perQuestion || item.position === 0}
          onClick={() => void exam.go(item.position - 1)}
        >
          {t('exam.previous')}
        </Button>
        <Button
          variant="secondary"
          disabled={atEnd}
          onClick={() => void exam.go(item.position + 1)}
        >
          {t('exam.next')}
        </Button>
        <Link className={buttonClass()} to={`/exam/sessions/${sessionId}/check`}>
          {t('exam.check')}
        </Link>
      </Row>
      <ExamMap state={state} onGo={(p) => void exam.go(p)} />
    </Stack>
  );
}
