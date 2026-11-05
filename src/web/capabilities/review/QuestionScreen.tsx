import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { QuestionResponse } from '../../../contracts/questions.js';
import { Alert, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchQuestion } from './api.js';
import { DecisionsCard } from './DecisionsCard.js';
import { StudyNoteCard } from './StudyNoteCard.js';
import { DeleteCard } from './DeleteCard.js';
import { FixCard } from './FixCard.js';
import { HistoryCard } from './HistoryCard.js';
import { NotesCard } from './NotesCard.js';
import { PicturesCard } from './PicturesCard.js';
import { QuestionForm } from './QuestionForm.js';
import { ReportsCard } from './ReportsCard.js';

/** Cards other capabilities add to the editor, composed in by the app. */
export type QuestionExtras = (
  question: QuestionResponse,
  onChange: (q: QuestionResponse) => void,
) => ReactNode;

interface CardsProps {
  question: QuestionResponse;
  onChange(q: QuestionResponse): void;
  extras: QuestionExtras | undefined;
}

function QuestionCards({ question, onChange, extras }: CardsProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <>
      <Link to={`/banks/${question.bankId}/review`}>{t('review.title')}</Link>
      <Heading>
        {t('editor.title')} {question.number}
      </Heading>
      <MutedText>
        {t('review.page')} {question.page}
      </MutedText>
      <DecisionsCard question={question} onChange={onChange} />
      <StudyNoteCard note={question.studyNote} />
      {extras?.(question, onChange)}
      <QuestionForm key={`form-${question.version}`} question={question} onSaved={onChange} />
      <PicturesCard question={question} />
      <FixCard question={question} onApplied={onChange} />
      <ReportsCard questionId={question.id} />
      <NotesCard questionId={question.id} />
      <HistoryCard key={`history-${question.version}`} question={question} onRestored={onChange} />
      <DeleteCard
        questionId={question.id}
        onDeleted={() => void navigate(`/banks/${question.bankId}/review`)}
      />
    </>
  );
}

/** The question as last changed here, unless the loaded copy is another or newer one. */
function newest(changed: QuestionResponse | null, loaded: QuestionResponse | null) {
  if (!changed || !loaded || changed.id !== loaded.id) return loaded;
  return changed.version >= loaded.version ? changed : loaded;
}

/**
 * One question with everything about it (UI-11): edit, decide, compare, notes, history. Other
 * capabilities' cards (re-import choice, moving) are composed in by the app.
 */
export function QuestionScreen({ extras }: { extras?: QuestionExtras }) {
  const { t } = useI18n();
  const id = useParams()['id'] ?? '';
  const load = useCallback(() => fetchQuestion(id), [id]);
  const { state } = useQuery(load);
  const [changed, setChanged] = useState<QuestionResponse | null>(null);
  const question = newest(changed, state.status === 'ready' ? state.data : null);
  return (
    <Stack>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {question && <QuestionCards question={question} onChange={setChanged} extras={extras} />}
    </Stack>
  );
}
