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
  /** Pictures shown with each option, by its letter (M34). */
  optionPictureIds: Readonly<Record<string, readonly string[]>>;
  /** The case several questions share, shown in full with each of them (M34, Z8). */
  case: { text: string; pictures: readonly string[] } | null;
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

/** Enlargeable pictures in a grid; the one picture grid of every solving screen (M34). */
export function PictureGrid({
  ids,
  pictureUrl,
}: {
  ids: readonly string[];
  pictureUrl(id: string): string | null;
}) {
  const { t } = useI18n();
  if (ids.length === 0) return null;
  return (
    <Grid>
      {ids.map((id) => {
        const src = pictureUrl(id);
        return src === null ? null : (
          <ZoomableImage key={id} src={src} alt={t('editor.pictures')} zoom={1} />
        );
      })}
    </Grid>
  );
}

/** A question: its shared case, stem, enlargeable pictures (FR-12-009) and its options. */
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
  const optionPictures = Object.entries(question.optionPictureIds).filter(
    ([, ids]) => ids.length > 0,
  );
  return (
    <Card>
      <Stack>
        {question.case && (
          <Stack>
            <p dir="auto">{question.case.text}</p>
            <PictureGrid ids={question.case.pictures} pictureUrl={pictureUrl} />
          </Stack>
        )}
        <p dir="auto">{question.stem}</p>
        <PictureGrid ids={question.pictureIds} pictureUrl={pictureUrl} />
        <ChoiceList
          legend={t('study.choices')}
          choices={choices}
          selected={selected}
          multiple={question.multiSelect}
          disabled={disabled}
          onChange={onChoose}
        />
        {optionPictures.map(([letter, ids]) => (
          <Stack key={letter}>
            <p>{`${t('study.optionPictures')} ${letter}`}</p>
            <PictureGrid ids={ids} pictureUrl={pictureUrl} />
          </Stack>
        ))}
        {children}
      </Stack>
    </Card>
  );
}
