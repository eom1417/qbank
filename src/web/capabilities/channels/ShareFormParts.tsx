import { useCallback, useId } from 'react';
import { Alert, Button, Checkbox, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTaxonomy } from '../library/taxonomy-api.js';
import { fetchExposure } from './api.js';
import { fill } from '../../platform/i18n/fill.js';
import { toggleChapter } from './policy-form.js';
import type { RuleProps } from './RuleGroup.js';
import { RulesReveal, RulesRecords } from './RulesAfter.js';
import { RulesWhat, RulesWho } from './RulesWhatWho.js';
import { RulesWhen } from './RulesWhen.js';
import type { ShareDraft } from './use-share-draft.js';

export interface Chapter {
  id: string;
  name: string;
}

/** The bank's chapters, to choose from and to name in the preview. */
export function useChapters(bankId: string): Chapter[] {
  const { state } = useQuery(useCallback(() => fetchTaxonomy(bankId), [bankId]));
  return state.status === 'ready' ? state.data.chapters : [];
}

/** Which chapters are shared; none chosen means the whole bank. */
export function ChapterChoice({ draft, chapters }: { draft: ShareDraft; chapters: Chapter[] }) {
  const { t } = useI18n();
  if (chapters.length === 0) return null;
  const chosen = draft.policy.content.chapterIds;
  return (
    <fieldset className="qb-stack">
      <legend className="qb-field__label">{t('sharing.form.chapters')}</legend>
      {chapters.map((chapter) => (
        <Checkbox
          key={chapter.id}
          label={<bdi>{chapter.name}</bdi>}
          checked={chosen.includes(chapter.id)}
          onChange={() => draft.setPolicy((p) => toggleChapter(p, chapter.id))}
        />
      ))}
    </fieldset>
  );
}

const ids = (key: string) => (key ? key.split(',') : []);

/** Before publishing: how much of this choice already went out, or is held by an exam. */
export function ExposureNotice({ bankId, draft }: { bankId: string; draft: ShareDraft }) {
  const { t } = useI18n();
  const chapterKey = draft.policy.content.chapterIds.join(',');
  const fixedKey = draft.policy.content.fixedQuestionIds.join(',');
  const { state } = useQuery(
    useCallback(
      () => fetchExposure(bankId, ids(chapterKey), ids(fixedKey)),
      [bankId, chapterKey, fixedKey],
    ),
  );
  if (state.status !== 'ready') return null;
  const { inScope, exposed, reserved } = state.data;
  const showReserved = draft.kind === 'agent' && reserved > 0;
  return (
    <Alert tone="info">
      <Stack>
        <span>{fill(t('sharing.exposure.inScope'), { n: inScope })}</span>
        {exposed > 0 && <strong>{fill(t('sharing.exposure.exposed'), { n: exposed })}</strong>}
        {showReserved && <span>{fill(t('sharing.exposure.reserved'), { n: reserved })}</span>}
      </Stack>
    </Alert>
  );
}

/** Everything beyond the name, chapters and size, grouped by the six questions, folded away. */
export function AdvancedRules(props: RuleProps & { open: boolean; onToggle(): void }) {
  const { t } = useI18n();
  const regionId = useId();
  return (
    <Stack>
      <Button
        variant="ghost"
        aria-expanded={props.open}
        aria-controls={regionId}
        onClick={props.onToggle}
      >
        {t(props.open ? 'sharing.form.advanced.hide' : 'sharing.form.advanced.show')}
      </Button>
      <div id={regionId} hidden={!props.open}>
        <Stack>
          <RulesWhat {...props} />
          <RulesWho {...props} />
          <RulesWhen {...props} />
          <RulesReveal {...props} />
          <RulesRecords {...props} />
        </Stack>
      </div>
    </Stack>
  );
}
