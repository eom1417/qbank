import { useEffect, useMemo } from 'react';
import type { ProviderView } from '../../../contracts/providers.js';
import type { ApprovedModelsResponse, ModelTier } from '../../../contracts/sources.js';
import { ChoiceList, MutedText } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchApprovedModels } from './api.js';

const TIERS: readonly ModelTier[] = ['light', 'strong'];

/** The tiers this instance can run: those with an approved model it offers (Q14). */
export function offeredTiers(
  approved: ApprovedModelsResponse,
  provider: ProviderView | undefined,
): ModelTier[] {
  const offered = new Set(provider?.models.map((model) => model.slug) ?? []);
  return TIERS.filter((tier) =>
    Object.values(approved.kinds).some((kind) => kind[tier].some((m) => offered.has(m))),
  );
}

interface TierChoiceProps {
  provider: ProviderView | undefined;
  tier: ModelTier;
  onTier(tier: ModelTier): void;
}

/** "Light (faster, cheaper)" or "Strong (most careful)", among the approved models only (Q14). */
export function TierChoice({ provider, tier, onTier }: TierChoiceProps) {
  const { t } = useI18n();
  const { state } = useQuery(fetchApprovedModels);
  const tiers = useMemo(
    () => (state.status === 'ready' ? offeredTiers(state.data, provider) : []),
    [state, provider],
  );
  const first = tiers[0];
  // A tier the instance cannot run is never sent: the first one it can run is chosen instead.
  useEffect(() => {
    if (first && !tiers.includes(tier)) onTier(first);
  }, [first, tier, tiers, onTier]);
  if (state.status !== 'ready') return null;
  if (!first) return <MutedText>{t('import.tier.none')}</MutedText>;
  return (
    <ChoiceList
      legend={t('import.tier.legend')}
      multiple={false}
      selected={[tier]}
      choices={tiers.map((value) => ({ value, label: t(`import.tier.${value}`) }))}
      onChange={([value]) => {
        if (value === 'light' || value === 'strong') onTier(value);
      }}
    />
  );
}
