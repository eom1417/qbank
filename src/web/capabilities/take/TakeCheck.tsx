import { Alert, Button, ConfirmButton, Row, Stack, Title } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { CheckSummary } from '../exam-ui/CheckSummary.js';
import { navigationOf } from './take-flow.js';
import type { useAttempt } from './use-attempt.js';

/**
 * The check before submitting: the counts, the questions still open that the rules let the
 * person reach, and a deliberate two-step submission.
 */
export function TakeCheck({
  attempt,
  onBack,
}: {
  attempt: ReturnType<typeof useAttempt>;
  onBack(position: number): void;
}) {
  const { t } = useI18n();
  const submit = useAction(attempt.submit);
  const { state } = attempt;
  const nav = navigationOf(state.allowed, state.position, state.total);
  const open = state.items.filter((i) => (!i.answered || i.flagged) && nav.canGo(i.position));
  return (
    <Stack>
      <Title>{t('exam.check.title')}</Title>
      <CheckSummary items={state.items} />
      <Row>
        {open.map((i) => (
          <Button key={i.position} variant="secondary" onClick={() => onBack(i.position)}>
            {t('exam.question')} {i.position + 1}
          </Button>
        ))}
      </Row>
      {submit.error && <Alert tone="error">{t(submit.error)}</Alert>}
      <Row>
        <Button variant="secondary" onClick={() => onBack(state.position)}>
          {t('exam.check.back')}
        </Button>
        <ConfirmButton
          label={t('take.submit')}
          confirmLabel={t('take.submit.confirm')}
          busy={submit.busy}
          onConfirm={() => void submit.run()}
        />
      </Row>
    </Stack>
  );
}
