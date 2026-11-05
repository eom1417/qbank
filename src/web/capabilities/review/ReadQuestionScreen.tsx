import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, buttonClass, Card, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { AiVerdict } from './AiVerdict.js';
import { AiChangeBadges, StudyNoteCard } from './StudyNoteCard.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchQuestion } from './api.js';
import { NotesCard } from './NotesCard.js';
import { PicturesCard } from './PicturesCard.js';

/**
 * Reading a question (FR-17-005, JY-18): its text, answer and explanation, and the owner's own
 * notes. Nothing here records an attempt or changes accuracy.
 */
export function ReadQuestionScreen() {
  const { t } = useI18n();
  const id = useParams()['id'] ?? '';
  const { state } = useQuery(useCallback(() => fetchQuestion(id), [id]));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const q = state.data;
  return (
    <Stack>
      <Heading>
        {t('read.title')} · {t('editor.title')} {q.number}
      </Heading>
      <MutedText>{t('read.lead')}</MutedText>
      <Card>
        <Stack>
          <p dir="auto">{q.stem}</p>
          {q.options.map((o) => (
            <p key={o.letter} dir="auto">
              {o.label} {o.text}
            </p>
          ))}
          <MutedText>
            {t('read.answer')} {q.answers.join(', ') || '—'} · {t('editor.provenance')}{' '}
            {t(`editor.provenance.${q.provenance}`)}
          </MutedText>
          <AiChangeBadges changes={q.aiChanges} />
          <AiVerdict question={q} />
          {q.explanation && <p dir="auto">{q.explanation}</p>}
          {q.updateNote && <Alert tone="info">{q.updateNote}</Alert>}
        </Stack>
      </Card>
      <StudyNoteCard note={q.studyNote} />
      <PicturesCard question={q} />
      <NotesCard questionId={q.id} />
      <Link className={buttonClass('secondary')} to={`/questions/${q.id}`}>
        {t('search.edit')}
      </Link>
    </Stack>
  );
}
