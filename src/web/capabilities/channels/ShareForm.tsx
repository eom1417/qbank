import type { ShareSecretResponse } from '../../../contracts/sharing.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Row,
  Stack,
  Subtitle,
  TextField,
  Title,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { PolicyCard } from './PolicyCard.js';
import type { Preset } from './presets.js';
import { RuleNumber } from './RuleFields.js';
import { SIZE_AGENT, SIZE_PEOPLE } from './rule-options.js';
import {
  AdvancedRules,
  ChapterChoice,
  ExposureNotice,
  useChapters,
  type Chapter,
} from './ShareFormParts.js';
import { useShareDraft, type ShareDraft } from './use-share-draft.js';
import { useSharePublish } from './use-share-publish.js';

interface Props {
  bankId: string;
  preset: Preset;
  onBack(): void;
  onCreated(created: ShareSecretResponse): void;
}

/** The live preview: the very card receivers will see. */
function Preview({ draft, chapters }: { draft: ShareDraft; chapters: Chapter[] }) {
  const { t } = useI18n();
  const chosen = new Set(draft.policy.content.chapterIds);
  const names = chapters.filter((c) => chosen.has(c.id)).map((c) => c.name);
  return (
    <>
      <Subtitle>{t('sharing.form.preview')}</Subtitle>
      <PolicyCard
        kind={draft.kind}
        name={draft.name || t(`sharing.kind.${draft.kind}`)}
        policy={draft.policy}
        chapterNames={names}
      />
    </>
  );
}

/** The fields everyone sets: the name, the chapters and the size. */
function MainFields({
  draft,
  chapters,
  sizeError,
}: {
  draft: ShareDraft;
  chapters: Chapter[];
  sizeError: string | undefined;
}) {
  const { t } = useI18n();
  const agent = draft.kind === 'agent';
  return (
    <>
      <TextField
        label={t('sharing.form.name')}
        value={draft.name}
        required
        maxLength={100}
        onChange={(e) => draft.setName(e.target.value)}
      />
      <ChapterChoice draft={draft} chapters={chapters} />
      <RuleNumber
        label={t(agent ? 'sharing.form.size.agent' : 'sharing.form.size.attempt')}
        value={draft.policy.content.size}
        options={agent ? SIZE_AGENT : SIZE_PEOPLE}
        format={String}
        noneLabel={t('sharing.form.none')}
        onChange={(size) => draft.set('content', { size: size ?? 1 })}
        error={sizeError}
      />
    </>
  );
}

/** Step 2 of a new share: the policy, a live preview, the rights confirmation, publish. */
export function ShareForm({ bankId, preset, onBack, onCreated }: Props) {
  const { t } = useI18n();
  const draft = useShareDraft(preset);
  const chapters = useChapters(bankId);
  const p = useSharePublish(bankId, draft, onCreated);
  return (
    <Card>
      <form onSubmit={p.onSubmit}>
        <Stack>
          <Title>
            <span aria-hidden="true">{preset.icon}</span> {t(`sharing.preset.${preset.id}`)}
          </Title>
          <MainFields draft={draft} chapters={chapters} sizeError={p.errors['content.size']} />
          <AdvancedRules
            draft={draft}
            errors={p.errors}
            open={p.advanced}
            onToggle={p.toggleAdvanced}
          />
          <ExposureNotice bankId={bankId} draft={draft} />
          <Preview draft={draft} chapters={chapters} />
          <Checkbox
            label={t('sharing.form.rights')}
            checked={draft.rights}
            onChange={(e) => draft.setRights(e.target.checked)}
            error={p.rightsMissing ? t('sharing.form.rights.required') : undefined}
          />
          {p.showFix && <Alert tone="error">{t('sharing.form.fix')}</Alert>}
          {p.publish.error && <Alert tone="error">{t(p.publish.error)}</Alert>}
          <Row>
            <Button type="submit" busy={p.publish.busy}>
              {t('sharing.form.publish')}
            </Button>
            <Button variant="ghost" onClick={onBack}>
              {t('sharing.flow.back')}
            </Button>
          </Row>
        </Stack>
      </form>
    </Card>
  );
}
