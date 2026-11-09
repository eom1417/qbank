import type { ReactNode } from 'react';
import { Alert, Button, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import type { QueryState } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';

interface Props<T> {
  title: string;
  lead?: string;
  state: QueryState<T>;
  onRefresh(): void;
  children(data: T): ReactNode;
}

/** One card of the operator console: a title with a refresh button, then its loaded content. */
export function OperatorCard<T>({ title, lead, state, onRefresh, children }: Props<T>) {
  const { t } = useI18n();
  return (
    <Card>
      <Stack>
        <Row>
          <span className="qb-grow">
            <Subtitle>{title}</Subtitle>
          </span>
          <Button variant="ghost" onClick={onRefresh}>
            {t('operator.refresh')}
          </Button>
        </Row>
        {lead && <MutedText>{lead}</MutedText>}
        {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
        {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
        {state.status === 'ready' && children(state.data)}
      </Stack>
    </Card>
  );
}

/** The local date and time of an ISO instant, in the UI language. */
export function useWhen() {
  const { locale } = useI18n();
  return (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
