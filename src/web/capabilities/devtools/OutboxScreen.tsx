import { OutboxResponse } from '../../../contracts/dev.js';
import { Alert, Card, Heading, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';

const fetchOutbox = () => apiRequest('GET', '/api/dev/outbox', OutboxResponse);

/** Local mail outbox (DEC-28): read the e-mails the app would have sent. Development only. */
export function OutboxScreen() {
  const { t } = useI18n();
  const { state } = useQuery(fetchOutbox);
  return (
    <Stack>
      <Heading>{t('dev.outbox.title')}</Heading>
      <MutedText>{t('dev.outbox.intro')}</MutedText>
      {state.status === 'error' && <Alert tone="info">{t('dev.outbox.disabled')}</Alert>}
      {state.status === 'ready' && state.data.messages.length === 0 && (
        <MutedText>{t('dev.outbox.empty')}</MutedText>
      )}
      {state.status === 'ready' &&
        state.data.messages.map((message) => (
          <Card key={message.id}>
            <Subtitle>{message.subject}</Subtitle>
            <MutedText>
              {message.to} · {new Date(message.createdAt).toLocaleString()}
            </MutedText>
            <pre className="qb-pre" dir="auto">
              {message.text}
            </pre>
          </Card>
        ))}
    </Stack>
  );
}
