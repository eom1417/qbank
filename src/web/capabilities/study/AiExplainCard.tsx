import { useState } from 'react';
import type { AiExplanationResponse } from '../../../contracts/study.js';
import {
  Alert,
  Button,
  Card,
  MutedText,
  SelectField,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useReadyProviders } from '../providers/ready-providers.js';
import { explainWithAi } from './api.js';

type Explained = Extract<AiExplanationResponse, { outcome: 'explained' }>;

function ExplanationView({ reply }: { reply: Explained }) {
  const { t } = useI18n();
  return (
    <Stack>
      <MutedText>
        {t('study.ai.by')} <bdi>{reply.generatedBy}</bdi> · {t('study.ai.confidence')}{' '}
        {t(`study.ai.confidence.${reply.confidence}`)}
      </MutedText>
      <p dir="auto">{reply.explanation}</p>
      {reply.options.map((o) => (
        <p key={o.letter} dir="auto">
          {o.letter}. {o.why}
        </p>
      ))}
      {reply.caveats && (
        <Alert tone="info">
          {t('study.ai.caveats')} {reply.caveats}
        </Alert>
      )}
    </Stack>
  );
}

/** The user's AI explains, apart from the book and labelled as theirs (FR-08-005, UAT-043). */
export function AiExplainCard({ sessionId, position }: { sessionId: string; position: number }) {
  const { t } = useI18n();
  const providers = useReadyProviders();
  const [instance, setInstance] = useState('');
  const [reply, setReply] = useState<AiExplanationResponse | null>(null);
  const chosen = instance || providers[0]?.value || '';
  const ask = useAction(async () => setReply(await explainWithAi(sessionId, position, chosen)));
  if (providers.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('study.ai.title')}</Subtitle>
        <MutedText>{t('study.ai.lead')}</MutedText>
        <SelectField
          label={t('import.ai.label')}
          options={providers}
          value={chosen}
          onChange={(e) => setInstance(e.target.value)}
        />
        <Button variant="secondary" busy={ask.busy} onClick={() => void ask.run()}>
          {t('study.ai.ask')}
        </Button>
        {ask.error && <Alert tone="error">{t(ask.error)}</Alert>}
        {reply?.outcome === 'failed' && (
          <Alert tone="error">
            {t('editor.fix.failed')} {reply.failure}
          </Alert>
        )}
        {reply?.outcome === 'explained' && <ExplanationView reply={reply} />}
      </Stack>
    </Card>
  );
}
