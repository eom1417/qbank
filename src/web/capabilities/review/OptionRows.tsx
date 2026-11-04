import { Button, Checkbox, Row, Stack, Subtitle, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import type { EditorState } from './editor-state.js';

/** The options with their text, which ones are right, and adding or removing one (UAT-033). */
export function OptionRows({ editor }: { editor: EditorState }) {
  const { t } = useI18n();
  return (
    <Stack>
      <Subtitle>{t('editor.options')}</Subtitle>
      {editor.options.map((option) => (
        <Row key={option.letter}>
          <TextField
            label={`${t('editor.option')} ${option.letter}`}
            dir="auto"
            value={option.text}
            onChange={(event) => editor.setOptionText(option.letter, event.target.value)}
          />
          <Checkbox
            label={t('editor.answers')}
            checked={editor.answers.includes(option.letter)}
            onChange={() => editor.toggleAnswer(option.letter)}
          />
          {editor.options.length > 2 && (
            <Button variant="ghost" onClick={() => editor.removeOption(option.letter)}>
              {t('editor.removeOption')}
            </Button>
          )}
        </Row>
      ))}
      {editor.canAdd && (
        <Button variant="secondary" onClick={editor.addOption}>
          {t('editor.addOption')}
        </Button>
      )}
    </Stack>
  );
}
