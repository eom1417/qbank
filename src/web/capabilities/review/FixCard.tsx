import { useState } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import type { FixSuggestionResponse } from '../../../contracts/review.js';
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
import { DisclosureNote } from '../providers/DisclosureNote.js';
import { targetOfChoice, useAiChoices, useRememberedChoice } from '../providers/ready-providers.js';
import { editQuestion, suggestFix } from './api.js';
import { QuestionTextDiff } from './QuestionTextDiff.js';

type Suggested = Extract<FixSuggestionResponse, { outcome: 'suggested' }>;

/** The suggestion against the current text, then applying it as the owner's edit. */
function SuggestionView({
  question,
  suggestion,
  onApplied,
}: {
  question: QuestionResponse;
  suggestion: Suggested;
  onApplied(q: QuestionResponse): void;
}) {
  const { t } = useI18n();
  const apply = useAction(async () =>
    onApplied(
      await editQuestion(question.id, {
        expectedVersion: question.version,
        stem: suggestion.stem,
        options: suggestion.options,
        fromAiSuggestion: true,
      }),
    ),
  );
  return (
    <Stack>
      <QuestionTextDiff before={question} after={suggestion} />
      <MutedText>
        {t('editor.fix.reason')} {suggestion.reason}
      </MutedText>
      <MutedText>
        {t('editor.fix.evidence')} «{suggestion.evidence}»
      </MutedText>
      {apply.error && <Alert tone="error">{t(apply.error)}</Alert>}
      <Button busy={apply.busy} onClick={() => void apply.run()}>
        {t('editor.fix.apply')}
      </Button>
    </Stack>
  );
}

/** What the AI answered: a suggestion to compare, a reason it was set aside, or a failure. */
function ReplyView({
  question,
  reply,
  onApplied,
}: {
  question: QuestionResponse;
  reply: FixSuggestionResponse;
  onApplied(q: QuestionResponse): void;
}) {
  const { t } = useI18n();
  if (reply.outcome === 'refused')
    return <Alert tone="info">{t(`editor.fix.refused.${reply.why}`)}</Alert>;
  if (reply.outcome === 'failed')
    return (
      <Alert tone="error">
        {t('editor.fix.failed')} {reply.failure}
      </Alert>
    );
  return <SuggestionView question={question} suggestion={reply} onApplied={onApplied} />;
}

/** Choosing the AI and asking; only signed-in instances are offered. */
function AskForm({
  providers,
  chosen,
  onChoose,
  ask,
}: {
  providers: { value: string; label: string }[];
  chosen: string;
  onChoose(v: string): void;
  ask: { busy: boolean; run(): Promise<void> };
}) {
  const { t } = useI18n();
  if (providers.length === 0) return <MutedText>{t('editor.fix.noProvider')}</MutedText>;
  return (
    <>
      <SelectField
        label={t('import.ai.label')}
        options={providers}
        value={chosen}
        onChange={(e) => onChoose(e.target.value)}
      />
      <DisclosureNote />
      <Button variant="secondary" busy={ask.busy} onClick={() => void ask.run()}>
        {t('editor.fix.ask')}
      </Button>
    </>
  );
}

/** The chosen instance and model; only offered choices reach here. */
const targetOf = (choice: string) => targetOfChoice(choice) ?? { instanceId: choice };

/** Asking the user's AI to fix reading errors only, shown as a diff (FR-09-005, M7.4). */
export function FixCard({
  question,
  onApplied,
}: {
  question: QuestionResponse;
  onApplied(q: QuestionResponse): void;
}) {
  const { t } = useI18n();
  const providers = useAiChoices();
  const [chosen, setInstance] = useRememberedChoice('fix', providers, providers[0]?.value ?? '');
  const [reply, setReply] = useState<FixSuggestionResponse | null>(null);
  const ask = useAction(async () => setReply(await suggestFix(question.id, targetOf(chosen))));
  const applied = (q: QuestionResponse) => {
    setReply(null);
    onApplied(q);
  };
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.fix.title')}</Subtitle>
        <MutedText>{t('editor.fix.lead')}</MutedText>
        <AskForm providers={providers} chosen={chosen} onChoose={setInstance} ask={ask} />
        {ask.error && <Alert tone="error">{t(ask.error)}</Alert>}
        {reply && <ReplyView question={question} reply={reply} onApplied={applied} />}
      </Stack>
    </Card>
  );
}
