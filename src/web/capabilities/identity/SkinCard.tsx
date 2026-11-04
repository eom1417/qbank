import { DEFAULT_SKIN, SKINS, type Skin } from '../../../contracts/identity.js';
import {
  Alert,
  Card,
  MutedText,
  SkinPicker,
  Stack,
  Subtitle,
  useTheme,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

/** The experience switch: applied at once on this browser, then saved to the account. */
export function SkinCard() {
  const { t } = useI18n();
  const { skin, setSkin } = useTheme();
  const { updateAccount } = useSession();
  const save = useAction(async (next: Skin) => updateAccount({ skin: next }));
  const options = SKINS.map((value) => ({
    value,
    label: t(`skin.${value}`),
    description: t(`skin.${value}.hint`),
    badge: value === DEFAULT_SKIN ? t('settings.skin.default') : undefined,
  }));
  const choose = (value: string) => {
    setSkin(value);
    void save.run(value as Skin);
  };
  return (
    <Card>
      <Stack>
        <Subtitle>{t('settings.skin.title')}</Subtitle>
        <MutedText>{t('settings.skin.lead')}</MutedText>
        <SkinPicker
          legend={t('settings.skin.legend')}
          options={options}
          value={skin}
          onChange={choose}
        />
        {save.error && <Alert tone="error">{t(save.error)}</Alert>}
      </Stack>
    </Card>
  );
}
