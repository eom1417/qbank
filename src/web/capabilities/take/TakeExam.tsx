import { useState } from 'react';
import type { TakeItemResponse } from '../../../contracts/take.js';
import { Alert, Button, MutedText, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { AnswerVerdict } from '../exam-ui/AnswerVerdict.js';
import { markedChoices } from '../exam-ui/choices.js';
import { ExamMap } from '../exam-ui/ExamMap.js';
import { ExamMoves } from '../exam-ui/ExamMoves.js';
import { ExamProgress } from '../exam-ui/ExamProgress.js';
import { QuestionCard } from '../exam-ui/QuestionCard.js';
import { SaveState } from '../exam-ui/SaveState.js';
import { navigationOf } from './take-flow.js';
import { TakeBanner } from './TakeBanner.js';
import { TakeCheck } from './TakeCheck.js';
import type { useAttempt } from './use-attempt.js';
import { usePictures } from './use-pictures.js';

type Attempt = ReturnType<typeof useAttempt>;

/** In a practice that reveals answers: the answer right after the choice is saved. */
function Feedback({ item }: { item: TakeItemResponse }) {
  const { feedback } = item;
  if (!feedback) return null;
  return (
    <AnswerVerdict
      correct={feedback.correct}
      answers={feedback.answers}
      explanation={feedback.explanation}
      startOpen={true}
      emptyText={null}
    />
  );
}

/** The question as the share shows it, marked only once the server reveals the answer. */
function TakeQuestion({ attempt, item }: { attempt: Attempt; item: TakeItemResponse }) {
  const { t } = useI18n();
  const pictureUrl = usePictures(attempt.api, item.pictureIds);
  const { feedback } = item;
  const reveal = feedback && { answers: feedback.answers, chosen: item.saved };
  return (
    <>
      <QuestionCard
        question={item}
        pictureUrl={pictureUrl}
        choices={markedChoices(item.options, reveal, t)}
        selected={item.saved}
        disabled={!item.changeable}
        onChoose={(chosen) => void attempt.choose(chosen)}
      >
        {!item.changeable && !feedback && <MutedText>{t('exam.locked')}</MutedText>}
      </QuestionCard>
      <Feedback key={item.position} item={item} />
    </>
  );
}

/** The question with its save state, the moves and the map. */
function Answering({
  attempt,
  item,
  onCheck,
}: {
  attempt: Attempt;
  item: TakeItemResponse;
  onCheck(): void;
}) {
  const { t } = useI18n();
  const { state } = attempt;
  const nav = navigationOf(state.allowed, item.position, item.total);
  return (
    <>
      <TakeQuestion attempt={attempt} item={item} />
      <SaveState status={attempt.saving} />
      {attempt.error && <Alert tone="error">{t(attempt.error)}</Alert>}
      <ExamMoves
        position={item.position}
        flagged={state.allowed.flag ? item.flagged : null}
        onFlag={attempt.toggleFlag}
        canPrevious={nav.canPrevious}
        canNext={nav.canNext}
        onGo={attempt.go}
        check={<Button onClick={onCheck}>{t('exam.check')}</Button>}
      />
      <ExamMap
        items={state.items}
        current={item.position}
        canGo={(i) => nav.canGo(i.position)}
        onGo={attempt.go}
      />
    </>
  );
}

/** The governed exam page: the banner, then the same question, clock and map as study. */
export function TakeExam({ attempt }: { attempt: Attempt }) {
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const { state, item } = attempt;
  const back = (position: number) => {
    setChecking(false);
    attempt.go(position);
  };
  if (!item)
    return attempt.error ? (
      <Alert tone="error">{t(attempt.error)}</Alert>
    ) : (
      <MutedText>{t('common.loading')}</MutedText>
    );
  return (
    <Stack>
      <TakeBanner state={state} />
      <ExamProgress
        position={item.position}
        total={item.total}
        secondsLeft={state.secondsLeft}
        onZero={attempt.timeUp}
      />
      {checking ? (
        <TakeCheck attempt={attempt} onBack={back} />
      ) : (
        <Answering attempt={attempt} item={item} onCheck={() => setChecking(true)} />
      )}
    </Stack>
  );
}
