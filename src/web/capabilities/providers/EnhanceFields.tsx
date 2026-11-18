import type { Enhancements } from '../../../contracts/sources.js';
import { Checkbox, MutedText, SelectField, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

type Switch = Exclude<keyof Enhancements, 'completeOptions'>;

/** Each improvement the owner may switch on or off, in the order they run. */
const SWITCHES: readonly Switch[] = [
  'improveCapture',
  'polishText',
  'verifyAnswers',
  'topicReview',
  'explainOptions',
  'updateNotes',
  'classify',
  'duplicates',
];
const COUNTS = [0, 3, 4, 5] as const;

interface Props {
  value: Enhancements;
  onChange(next: Enhancements): void;
  /** A pipeline import (Z2): no polishing and no new options are offered; the server refuses both. */
  sourceOnly?: boolean;
}

/** The option count, unless the import keeps only the file's own words. */
function CompleteOptions({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <SelectField
      label={t('enhance.completeOptions')}
      options={COUNTS.map((count) => ({
        value: String(count),
        label:
          count === 0
            ? t('enhance.completeOptions.off')
            : `${t('enhance.completeOptions.to')} ${count}`,
      }))}
      value={String(value.completeOptions)}
      onChange={(event) =>
        onChange({
          ...value,
          completeOptions: Number(event.target.value) as Enhancements['completeOptions'],
        })
      }
    />
  );
}

/**
 * "Improve questions with AI" (DEC-34): beyond organizing the file, which changes no content,
 * each improvement is the owner's choice, and options are completed up to a chosen number.
 */
export function EnhanceFields({ value, onChange, sourceOnly = false }: Props) {
  const { t } = useI18n();
  const switches = sourceOnly ? SWITCHES.filter((key) => key !== 'polishText') : SWITCHES;
  return (
    <Stack>
      <Subtitle>{t('enhance.title')}</Subtitle>
      <MutedText>{t('enhance.lead')}</MutedText>
      {!sourceOnly && <CompleteOptions value={value} onChange={onChange} />}
      {switches.map((key) => (
        <div key={key}>
          <Checkbox
            checked={value[key] !== false}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            label={t(`enhance.${key}` as MessageKey)}
          />
          <MutedText>{t(`enhance.${key}.hint` as MessageKey)}</MutedText>
        </div>
      ))}
    </Stack>
  );
}
