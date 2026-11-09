import type { ReactNode } from 'react';
import {
  Card,
  ChoiceList,
  Grid,
  Stack,
  ZoomableImage,
  type Choice,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** What a question card shows of a question, whoever serves it. */
interface CardQuestion {
  stem: string;
  pictureIds: readonly string[];
  multiSelect: boolean;
}

interface QuestionCardProps {
  question: CardQuestion;
  /** Where each picture is shown from; null while it is still on its way. */
  pictureUrl(id: string): string | null;
  /** The options as this mode may show them (marked only once the answer is known). */
  choices: readonly Choice[];
  selected: readonly string[];
  disabled: boolean;
  onChoose(chosen: string[]): void;
  children?: ReactNode;
}

/** A question: its stem, enlargeable pictures (FR-12-009) and its options. */
export function QuestionCard({
  question,
  pictureUrl,
  choices,
  selected,
  disabled,
  onChoose,
  children,
}: QuestionCardProps) {
  const { t } = useI18n();
  const pictures = question.pictureIds.map((id) => ({ id, src: pictureUrl(id) }));
  return (
    <Card>
      <Stack>
        <p dir="auto">{question.stem}</p>
        {pictures.length > 0 && (
          <Grid>
            {pictures.map(({ id, src }) =>
              src === null ? null : (
                <ZoomableImage key={id} src={src} alt={t('editor.pictures')} zoom={1} />
              ),
            )}
          </Grid>
        )}
        <ChoiceList
          legend={t('study.choices')}
          choices={choices}
          selected={selected}
          multiple={question.multiSelect}
          disabled={disabled}
          onChange={onChoose}
        />
        {children}
      </Stack>
    </Card>
  );
}
