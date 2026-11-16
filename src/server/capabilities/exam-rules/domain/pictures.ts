import type { CaseView, PlacedPictures, Snapshot } from './grading.js';

// M34 P1 (DEC-43, Z1, Z7, Z8): the one rule for which pictures a solver may see, and when.
// A picture placed in the explanation is shown only with the explanation. A picture imported
// before placements existed (no placement) keeps today's behaviour: shown in the owner's own
// study, never sent through a share or to an agent (Q65).

type Placement = 'question' | 'option' | 'explanation' | 'case';

/** Who is solving: the owner in their own study, or someone through a share or an agent. */
type Audience = 'owner' | 'shared';

interface SolverPictures {
  pictureIds: string[];
  optionPictureIds: Record<string, string[]>;
  case: CaseView | null;
}

const NONE: SolverPictures = { pictureIds: [], optionPictureIds: {}, case: null };

/** What the solver sees with the question, before any answer is revealed. */
export function picturesBeforeReveal(snapshot: Snapshot, audience: Audience): SolverPictures {
  const placed = snapshot.placed;
  if (!placed) return audience === 'owner' ? { ...NONE, pictureIds: snapshot.pictureIds } : NONE;
  return {
    // `pictureIds` holds the question's pictures and, for the owner only, unplaced ones (Q65).
    pictureIds: audience === 'owner' ? snapshot.pictureIds : placed.question,
    optionPictureIds: placed.options,
    case: placed.case,
  };
}

/** The explanation's own pictures: only where the explanation text itself is revealed. */
export function picturesWithExplanation(snapshot: Snapshot): string[] {
  return snapshot.placed?.explanation ?? [];
}

/** Whether one picture may be served now; `explained` is true once the explanation is shown. */
export function mayServePicture(
  snapshot: Snapshot,
  pictureId: string,
  audience: Audience,
  explained: boolean,
): boolean {
  const before = picturesBeforeReveal(snapshot, audience);
  const visible = [
    ...before.pictureIds,
    ...Object.values(before.optionPictureIds).flat(),
    ...(before.case?.pictureIds ?? []),
    ...(explained ? picturesWithExplanation(snapshot) : []),
  ];
  return visible.includes(pictureId);
}

interface PlacedRow {
  id: string;
  placement: Placement | null;
  option_letter: string | null;
}

/**
 * Sorts a question's picture rows (in their order) by placement. `shown` is what the owner sees
 * before the reveal: the question's pictures and the unplaced ones (Q65).
 */
export function placePictures(rows: readonly PlacedRow[], sharedCase: CaseView | null) {
  const placed: PlacedPictures = { question: [], options: {}, explanation: [], case: sharedCase };
  const shown: string[] = [];
  for (const row of rows) {
    if (row.placement === 'question') placed.question.push(row.id);
    if (row.placement === 'explanation') placed.explanation.push(row.id);
    if (row.placement === 'option' && row.option_letter) {
      placed.options[row.option_letter] = [...(placed.options[row.option_letter] ?? []), row.id];
    }
    if (row.placement === 'question' || row.placement === null) shown.push(row.id);
  }
  return { shown, placed };
}
