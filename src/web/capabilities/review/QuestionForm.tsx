import type { FormEvent } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import { Alert, Button, Card, Stack, TextArea } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { editQuestion } from './api.js';
import { useEditorState } from './editor-state.js';
import { AnswerImpact } from './AnswerImpact.js';
import { OptionRows } from './OptionRows.js';
import { ClassificationFields } from './ClassificationFields.js';
import { useClassification } from './classification-state.js';

interface Props {
  question: QuestionResponse;
  onSaved(question: QuestionResponse): void;
}

/** Editing the stem, options, answer, explanation and newer information (FR-09-003, UI-11). */
export function QuestionForm({ question, onSaved }: Props) {
  const { t } = useI18n();
  const editor = useEditorState(question);
  const place = useClassification(question);
  const save = useAction(async () =>
    onSaved(await editQuestion(question.id, { ...editor.request(), ...place.changes() })),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save.run();
  };
  return (
    <Card>
      <form className="qb-stack" onSubmit={submit} noValidate>
        {save.error && <Alert tone="error">{t(save.error)}</Alert>}
        <TextArea
          label={t('editor.stem')}
          value={editor.stem}
          onChange={(e) => editor.setStem(e.target.value)}
        />
        <OptionRows editor={editor} />
        <AnswerImpact
          questionId={question.id}
          answers={editor.answers}
          changed={editor.answers.join() !== question.answers.join()}
        />
        <Stack>
          <TextArea
            label={t('editor.explanation')}
            value={editor.explanation}
            onChange={(e) => editor.setExplanation(e.target.value)}
          />
          <TextArea
            label={t('editor.updateNote')}
            rows={2}
            value={editor.updateNote}
            onChange={(e) => editor.setUpdateNote(e.target.value)}
          />
        </Stack>
        <ClassificationFields question={question} state={place} />
        <Button type="submit" busy={save.busy}>
          {t('editor.save')}
        </Button>
      </form>
    </Card>
  );
}
