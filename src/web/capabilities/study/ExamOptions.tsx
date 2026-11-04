import { Alert, SelectField, Stack, Subtitle, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

export type TimingKind = 'none' | 'total' | 'per_question';

interface Props {
  timing: TimingKind;
  amount: number;
  onTiming(kind: TimingKind): void;
  onAmount(amount: number): void;
}

/**
 * An exam's time and its rules, said before it starts (FR-13-002…005, UI-16): what is hidden,
 * how answers are saved, how the time ends it, and how the score is counted (DEC-06…09 assumed).
 */
export function ExamOptions({ timing, amount, onTiming, onAmount }: Props) {
  const { t } = useI18n();
  const kinds: TimingKind[] = ['none', 'total', 'per_question'];
  return (
    <Stack>
      <SelectField
        label={t('exam.timing')}
        value={timing}
        options={kinds.map((k) => ({ value: k, label: t(`exam.timing.${k}`) }))}
        onChange={(e) => onTiming(e.target.value as TimingKind)}
      />
      {timing !== 'none' && (
        <TextField
          label={t(timing === 'total' ? 'exam.minutes' : 'exam.seconds')}
          type="number"
          min={1}
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
        />
      )}
      <Alert tone="info">
        <Subtitle>{t('exam.rules.title')}</Subtitle>
        <ul className="qb-steps">
          <li>{t('exam.rules.solutions')}</li>
          <li>{t('exam.rules.saving')}</li>
          <li>{t(`exam.rules.${timing}`)}</li>
          <li>{t('exam.rules.score')}</li>
        </ul>
      </Alert>
    </Stack>
  );
}

/** The timing sent to the server: minutes become seconds for a total time. */
export function timingOf(kind: TimingKind, amount: number) {
  if (kind === 'none') return { kind } as const;
  return {
    kind,
    seconds: kind === 'total' ? Math.max(1, amount) * 60 : Math.max(10, amount),
  } as const;
}
