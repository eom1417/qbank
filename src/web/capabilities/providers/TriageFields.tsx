import type { ProviderView } from '../../../contracts/providers.js';
import type { TriageModels } from '../../../contracts/sources.js';
import { MutedText, SelectField, Stack } from '../../design-system/index.js';
import { EnhanceFields } from './EnhanceFields.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { modelsOf, type TriageChoiceState } from './use-triage-choice.js';
import type { TriageQuality } from './triage-presets.js';

const QUALITIES: readonly TriageQuality[] = ['high', 'balanced', 'economy', 'custom'];
const ROLES: readonly (keyof TriageModels)[] = ['first', 'second', 'judge', 'improver'];

/** A model's name as the provider gives it, or the instance's default. */
function nameOf(provider: ProviderView, slug: string | undefined, fallback: string) {
  if (!slug) return fallback;
  return provider.models.find((model) => model.slug === slug)?.name ?? slug;
}

/** Which model plays each role, said plainly under the quality (names isolated for RTL). */
function RoleSummary({ state }: { state: TriageChoiceState }) {
  const { t } = useI18n();
  const provider = state.provider;
  if (!provider) return null;
  const models = modelsOf(state.choice, provider);
  const name = (role: keyof TriageModels) => (
    <bdi>{nameOf(provider, models[role], t('ai.model.default'))}</bdi>
  );
  return (
    <MutedText>
      {t('triage.role.solvers')}: {name('first')} + {name('second')} · {t('triage.role.judge')}:{' '}
      {name('judge')} · {t('triage.role.improver')}: {name('improver')}
    </MutedText>
  );
}

/** One select per role, for a custom quality. */
function CustomRoles({ state }: { state: TriageChoiceState }) {
  const { t } = useI18n();
  const provider = state.provider;
  if (!provider || state.choice.quality !== 'custom') return null;
  const options = [
    { value: '', label: t('ai.model.default') },
    ...provider.models.map((model) => ({ value: model.slug, label: model.name ?? model.slug })),
  ];
  return ROLES.map((role) => (
    <SelectField
      key={role}
      label={t(`triage.role.${role}` as MessageKey)}
      options={options}
      value={state.choice.custom[role] ?? ''}
      onChange={(event) => {
        const rest = Object.entries(state.choice.custom).filter(([other]) => other !== role);
        const chosen = event.target.value ? [[role, event.target.value]] : [];
        state.change({ custom: Object.fromEntries([...rest, ...chosen]) });
      }}
    />
  ));
}

/**
 * The AI of an import or a re-check (DEC-33): which provider, how strong (each role's model),
 * and whether to improve the questions first (DEC-04).
 */
export function TriageFields({ state }: { state: TriageChoiceState }) {
  const { t } = useI18n();
  const providers = [
    { value: '', label: t('import.ai.none') },
    ...state.providers.map((p) => ({ value: p.instanceId, label: p.displayName ?? p.driver })),
  ];
  return (
    <Stack>
      <SelectField
        label={t('import.ai.label')}
        options={providers}
        value={state.choice.instanceId}
        onChange={(event) => state.change({ instanceId: event.target.value })}
      />
      <MutedText>{t(state.provider ? 'triage.with' : 'import.ai.without')}</MutedText>
      {state.provider && (
        <SelectField
          label={t('triage.quality')}
          options={QUALITIES.map((q) => ({ value: q, label: t(`triage.quality.${q}`) }))}
          value={state.choice.quality}
          onChange={(event) => {
            const quality = event.target.value as TriageQuality;
            // Custom starts from the models the current quality uses, not from defaults.
            const custom =
              quality === 'custom' ? modelsOf(state.choice, state.provider) : state.choice.custom;
            state.change({ quality, custom });
          }}
        />
      )}
      <RoleSummary state={state} />
      <CustomRoles state={state} />
      {state.provider && (
        <EnhanceFields
          value={state.choice.enhance}
          onChange={(enhance) => state.change({ enhance })}
        />
      )}
    </Stack>
  );
}
