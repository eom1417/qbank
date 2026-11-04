import {
  Alert,
  Button,
  Card,
  Heading,
  NarrowColumn,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

/** Local mode (DEC-31): a browser that is not this computer pairs with the install's code. */
export function PairScreen() {
  const { t } = useI18n();
  const { pair } = useSession();
  const form = useSubmit((data) => pair(text(data, 'code').trim()));
  return (
    <NarrowColumn>
      <Heading>{t('local.pair.title')}</Heading>
      <p>{t('local.pair.lead')}</p>
      <Card>
        <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
          {form.error && <Alert tone="error">{t(form.error)}</Alert>}
          <TextField name="code" autoComplete="off" required label={t('local.pair.code')} />
          <Button type="submit" busy={form.busy}>
            {t('local.pair.submit')}
          </Button>
        </form>
      </Card>
    </NarrowColumn>
  );
}
