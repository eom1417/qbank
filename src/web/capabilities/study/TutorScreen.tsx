import { useNavigate, useParams } from 'react-router';
import type { ItemResponse } from '../../../contracts/study.js';
import { Alert, Button, type Choice, MutedText, Row, Stack } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { QuestionCard } from './QuestionBody.js';
import { AiExplainCard } from './AiExplainCard.js';
import { finishStudy } from './api.js';
import { MarksBar } from './MarksBar.js';
import { SolutionView } from './SolutionView.js';
import { useTutor } from './use-tutor.js';

/** Right answers are marked only once the solution is known (UAT-041). */
function choicesOf(item: ItemResponse): Choice[] {
  const right = new Set(item.solution?.answers ?? []);
  const chosen = new Set(item.solution?.chosen ?? []);
  return item.options.map((o) => {
    const mark: Choice['mark'] = right.has(o.letter)
      ? 'right'
      : chosen.has(o.letter)
        ? 'wrong'
        : undefined;
    return {
      value: o.letter,
      label: `${o.label} ${o.text}`,
      mark: item.solution ? mark : undefined,
    };
  });
}

/** The question as asked, its options marked only once answered. */
function QuestionView({ tutor }: { tutor: ReturnType<typeof useTutor> }) {
  const item = tutor.item as ItemResponse;
  return (
    <QuestionCard
      item={item}
      choices={choicesOf(item)}
      selected={tutor.selected}
      disabled={item.solution !== null}
      onChoose={tutor.setSelected}
    />
  );
}

/** Previous, next and finishing; moving saves the place on the server. */
function Navigation({
  tutor,
  sessionId,
}: {
  tutor: ReturnType<typeof useTutor>;
  sessionId: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const item = tutor.item as ItemResponse;
  const move = useAction(async (position: number) => tutor.go(position));
  const finish = useAction(async () => {
    await finishStudy(sessionId);
    void navigate(`/study/sessions/${sessionId}/summary`);
  });
  return (
    <Row>
      <Button
        variant="secondary"
        disabled={item.position === 0}
        busy={move.busy}
        onClick={() => void move.run(item.position - 1)}
      >
        {t('study.previous')}
      </Button>
      <Button
        variant="secondary"
        disabled={item.position >= item.total - 1}
        busy={move.busy}
        onClick={() => void move.run(item.position + 1)}
      >
        {t('study.next')}
      </Button>
      <Button variant="ghost" busy={finish.busy} onClick={() => void finish.run()}>
        {t('study.finish')}
      </Button>
    </Row>
  );
}

/** One question at a time: choose, send, then see the solution (UI-14, JY-07). */
export function TutorScreen() {
  const { t } = useI18n();
  const sessionId = useParams()['id'] ?? '';
  const tutor = useTutor(sessionId);
  const submit = useAction(tutor.submit);
  const item = tutor.item;
  if (tutor.error) return <Alert tone="error">{t(tutor.error as 'error.internal')}</Alert>;
  if (!item || !tutor.session) return <MutedText>{t('common.loading')}</MutedText>;
  return (
    <Stack>
      <MutedText>
        {t('study.progress')} {item.position + 1} {t('study.of')} {item.total}
      </MutedText>
      {!item.questionId && <Alert tone="info">{t('study.deleted')}</Alert>}
      {item.reason && (
        <MutedText>
          {t('plan.reason')} {t(`plan.reason.${item.reason}`)}
        </MutedText>
      )}
      <QuestionView tutor={tutor} />
      {item.solution === null ? (
        <Button
          busy={submit.busy}
          disabled={tutor.selected.length === 0}
          onClick={() => void submit.run()}
        >
          {t('study.submit')}
        </Button>
      ) : (
        <>
          <SolutionView solution={item.solution} />
          <AiExplainCard sessionId={sessionId} position={item.position} />
        </>
      )}
      {submit.error && <Alert tone="error">{t(submit.error)}</Alert>}
      <MarksBar item={item} onChange={tutor.setItem} />
      <Navigation tutor={tutor} sessionId={sessionId} />
    </Stack>
  );
}
