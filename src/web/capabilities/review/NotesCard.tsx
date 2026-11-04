import { useCallback, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  MutedText,
  Row,
  Stack,
  Subtitle,
  TextArea,
  TextField,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { addNote, fetchNotes } from './api.js';

const labelsOf = (text: string) =>
  text
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

/** Adding a note with optional labels. */
function NoteForm({ questionId, onAdded }: { questionId: string; onAdded(): void }) {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const add = useAction(async () => {
    await addNote(questionId, body, labelsOf(labels));
    setBody('');
    setLabels('');
    onAdded();
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void add.run();
  };
  return (
    <form className="qb-stack" onSubmit={submit} noValidate>
      {add.error && <Alert tone="error">{t(add.error)}</Alert>}
      <TextArea
        label={t('editor.notes.body')}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <TextField
        label={t('editor.notes.labels')}
        value={labels}
        onChange={(e) => setLabels(e.target.value)}
      />
      <Button type="submit" variant="secondary" busy={add.busy} disabled={body.trim() === ''}>
        {t('editor.notes.add')}
      </Button>
    </form>
  );
}

/** Private review notes with labels (FR-09-009): they never become question text. */
export function NotesCard({ questionId }: { questionId: string }) {
  const { t, locale } = useI18n();
  const load = useCallback(() => fetchNotes(questionId), [questionId]);
  const { state, reload } = useQuery(load);
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.notes')}</Subtitle>
        <MutedText>{t('editor.notes.lead')}</MutedText>
        {state.status === 'ready' &&
          state.data.notes.map((note) => (
            <Stack key={note.id}>
              <p dir="auto">{note.body}</p>
              <Row>
                {note.labels.map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
                <MutedText>{new Date(note.createdAt).toLocaleString(locale)}</MutedText>
              </Row>
            </Stack>
          ))}
        <NoteForm questionId={questionId} onAdded={reload} />
      </Stack>
    </Card>
  );
}
