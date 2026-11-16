/**
 * The pictures a share may give out (links and agents). None until M34: an import may have kept
 * a picture of the explanation as a question's picture, and a share must never show the answer
 * before its policy reveals it. M34 gives every picture its place (question or explanation) and
 * replaces this rule with one that gives out the question's own pictures only.
 */
export function sharedPictureIds(pictureIds: readonly string[]): string[] {
  // None passes until M34 knows which of them belong to the question itself.
  return pictureIds.slice(0, 0);
}
