/** Right only when the chosen letters are exactly the right ones (multiple-select included). */
export function isCorrect(chosen: readonly string[], answers: readonly string[]): boolean {
  const right = new Set(answers);
  const picked = new Set(chosen);
  return (
    right.size > 0 && picked.size === right.size && [...picked].every((letter) => right.has(letter))
  );
}

/** A case several questions share, shown in full with each of them (M34, Z8). */
export interface CaseView {
  text: string;
  pictureIds: string[];
}

/** A question's pictures by where they belong (M34); see `pictures.ts` for who sees what. */
export interface PlacedPictures {
  question: string[];
  options: Record<string, string[]>;
  explanation: string[];
  case: CaseView | null;
}

/** What a session item keeps of its question when the session begins (FR-23-007). */
export interface Snapshot {
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answers: string[];
  multiSelect: boolean;
  explanation: string | null;
  /** Shown to the owner before the reveal: the question's own and any unplaced pictures. */
  pictureIds: string[];
  /** Absent on snapshots taken before M34: then nothing goes through a share (Q65). */
  placed?: PlacedPictures;
  chapterId: string | null;
  version: number;
  /** Why a Smart Mix chose it (FR-14-008); absent for other kinds. */
  reason?: 'new' | 'weak' | 'due';
}
