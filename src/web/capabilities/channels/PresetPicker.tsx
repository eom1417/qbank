import { Button, Card, Stack, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { PRESETS, type Preset } from './presets.js';

interface Props {
  onPick(preset: Preset): void;
  onCancel(): void;
}

/** Step 1 of a new share: four starting points, each a complete policy already. */
export function PresetPicker({ onPick, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Title>{t('sharing.flow.pick')}</Title>
        {PRESETS.map((preset) => (
          <Button key={preset.id} variant="secondary" onClick={() => onPick(preset)}>
            <span aria-hidden="true">{preset.icon}</span>{' '}
            <strong>{t(`sharing.preset.${preset.id}`)}</strong>
            {' · '}
            {t(`sharing.preset.${preset.id}.lead`)}
          </Button>
        ))}
        <Button variant="ghost" onClick={onCancel}>
          {t('sharing.flow.cancel')}
        </Button>
      </Stack>
    </Card>
  );
}
