/** Right only when the chosen letters are exactly the right ones (multiple-select included). */
export function isCorrect(chosen: readonly string[], answers: readonly string[]): boolean {
  const right = new Set(answers);
  const picked = new Set(chosen);
  return (
    right.size > 0 && picked.size === right.size && [...picked].every((letter) => right.has(letter))
  );
}

/** What a session item keeps of its question when the session begins (FR-23-007). */
export interface Snapshot {
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answers: string[];
  multiSelect: boolean;
  explanation: string | null;
  pictureIds: string[];
  chapterId: string | null;
  version: number;
  /** Why a Smart Mix chose it (FR-14-008); absent for other kinds. */
  reason?: 'new' | 'weak' | 'due';
}
