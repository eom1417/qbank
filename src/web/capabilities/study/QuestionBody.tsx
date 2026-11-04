import type { ReactNode } from 'react';
import type { ItemResponse } from '../../../contracts/study.js';
import {
  Card,
  ChoiceList,
  Grid,
  Stack,
  ZoomableImage,
  type Choice,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

interface QuestionCardProps {
  item: ItemResponse;
  /** The options as this mode may show them (marked only after the answer, in Tutor). */
  choices: readonly Choice[];
  selected: readonly string[];
  disabled: boolean;
  onChoose(chosen: string[]): void;
  children?: ReactNode;
}

/** A session question: its stem, enlargeable pictures (FR-12-009) and its options. */
export function QuestionCard({
  item,
  choices,
  selected,
  disabled,
  onChoose,
  children,
}: QuestionCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <p dir="auto">{item.stem}</p>
        {item.pictureIds.length > 0 && (
          <Grid>
            {item.pictureIds.map((id) => (
              <ZoomableImage
                key={id}
                src={`/api/media/${id}`}
                alt={t('editor.pictures')}
                zoom={1}
              />
            ))}
          </Grid>
        )}
        <ChoiceList
          legend={t('study.choices')}
          choices={choices}
          selected={selected}
          multiple={item.multiSelect}
          disabled={disabled}
          onChange={onChoose}
        />
        {children}
      </Stack>
    </Card>
  );
}
