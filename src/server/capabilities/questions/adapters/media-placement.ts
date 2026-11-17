import type { Db } from '../../../platform/db/index.js';

// M34 P6 (Q26): the owner moved a question's picture (to the stem, an option, the explanation or
// the case) in the review editor; the stored picture follows, matched by its page and its box.

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PicturePlace {
  page: number;
  box: Box;
  placement: 'question' | 'option' | 'explanation' | 'case';
  optionLetter: string | null;
}

/** The share of the smaller box that the two boxes have in common. */
function overlap(a: Box, b: Box): number {
  const width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (width <= 0 || height <= 0) return 0;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 ? (width * height) / smaller : 0;
}

/** A picture cropped from this place covers at least this share of it. */
const SAME_PICTURE = 0.8;

/** Sets the placement of the question's pictures found at these places; returns how many moved. */
export async function placeMedia(
  db: Db,
  ownerId: string,
  questionId: string,
  places: readonly PicturePlace[],
): Promise<number> {
  const rows = await db
    .selectFrom('media')
    .select(['id', 'page', 'box'])
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .execute();
  let moved = 0;
  for (const place of places) {
    const row = rows.find(
      (r) => r.page === place.page && overlap(r.box as Box, place.box) >= SAME_PICTURE,
    );
    if (!row) continue;
    const optionLetter = place.placement === 'option' ? place.optionLetter : null;
    await db
      .updateTable('media')
      .set({ placement: place.placement, option_letter: optionLetter })
      .where('id', '=', row.id)
      .execute();
    moved += 1;
  }
  return moved;
}
