import { useState } from 'react';
import { SupportReportResponse } from '../../../contracts/portability.js';
import {
  Button,
  Card,
  CodeText,
  Heading,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useModeCopy } from '../identity/mode-copy.js';
import { FeedbackCard } from './FeedbackCard.js';

const TOPICS = ['pending', 'due', 'ai', 'import', 'rights', 'privacy'] as const;

/** A support report the owner reads, then copies themselves (FR-22-007): no content in it. */
function SupportCard() {
  const { t } = useI18n();
  const copy = useModeCopy();
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const build = useAction(async () =>
    setText(
      JSON.stringify(
        await apiRequest('GET', '/api/support/report', SupportReportResponse),
        null,
        2,
      ),
    ),
  );
  return (
    <Card>
      <Stack>
        <Subtitle>{t('support.title')}</Subtitle>
        <MutedText>{copy('support.lead')}</MutedText>
        <Button variant="secondary" busy={build.busy} onClick={() => void build.run()}>
          {t('support.build')}
        </Button>
        {text && (
          <>
            <CodeText>{text}</CodeText>
            <Button
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
            >
              {t(copied ? 'support.copied' : 'support.copy')}
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

/**
 * Short answers to the common questions, each reachable by its anchor (UI-28, FR-22-006); on a
 * server each answer that differs is read from its server variant (M31, B3).
 */
export function HelpScreen() {
  const { t } = useI18n();
  const copy = useModeCopy();
  return (
    <Stack>
      <Heading>{t('help.title')}</Heading>
      <MutedText>{t('help.lead')}</MutedText>
      <FeedbackCard />
      {TOPICS.map((topic) => (
        <section key={topic} id={topic}>
          <Card>
            <Stack>
              <Subtitle>{t(`help.${topic}.title`)}</Subtitle>
              <p>{copy(`help.${topic}.body`)}</p>
            </Stack>
          </Card>
        </section>
      ))}
      <SupportCard />
    </Stack>
  );
}
