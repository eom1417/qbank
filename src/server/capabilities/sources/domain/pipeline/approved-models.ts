// M34 P3: which models are approved for each lesson (decision Q42: approved per lesson, by
// measurement). A lesson with no approved model for the user's provider goes straight to review.

export type ProviderKind = 'claude' | 'codex';
export type ModelTier = 'light' | 'strong';

type TierModels = Readonly<Record<ModelTier, readonly string[]>>;
type LessonModels = Readonly<Record<ProviderKind, TierModels>>;

/** P0: a closed question over a contact sheet was 25/25 with the light Claude model. */
const CLAUDE: TierModels = { light: ['claude-haiku-5-5'], strong: ['claude-opus-5-5'] };
/** Not measured yet: nothing is approved, so its lessons escalate straight to review. */
const UNMEASURED: TierModels = { light: [], strong: [] };

const APPROVED: Readonly<Record<string, LessonModels>> = {
  'D1.2': { claude: CLAUDE, codex: UNMEASURED },
  'D4.mark': { claude: CLAUDE, codex: UNMEASURED },
  'D6.1': { claude: CLAUDE, codex: UNMEASURED },
};

/** The approved models of a lesson for a provider kind (empty for an unknown lesson). */
export function approvedModels(lessonId: string, kind: ProviderKind): TierModels {
  return APPROVED[lessonId]?.[kind] ?? UNMEASURED;
}

/** The first approved model of a tier, or null when none is approved (the item goes to review). */
export function modelFor(lessonId: string, kind: ProviderKind, tier: ModelTier): string | null {
  return approvedModels(lessonId, kind)[tier][0] ?? null;
}
