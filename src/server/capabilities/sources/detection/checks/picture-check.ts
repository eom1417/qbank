import type { Doubt, DraftQuestion } from '../contract.js';
import type { CheckContext } from './question-lines.js';

const firstOnPage = (q: DraftQuestion, page: number, { file }: CheckContext) =>
  [...(q.labelLine === null ? [] : [q.labelLine]), ...q.stem]
    .map((id) => file.lines[id])
    .find((line) => line?.page === page);

/**
 * A picture placed with the question or an option whose spot sits above its own question's first
 * line while another question already started on that page: it could close the one before.
 */
export function pictureCheck(
  q: DraftQuestion,
  index: number,
  ctx: CheckContext,
  all: DraftQuestion[],
): Doubt[] {
  return q.pictures.flatMap((picture): Doubt[] => {
    if (picture.placement !== 'question' && picture.placement !== 'option') return [];
    const { page, box } = picture.spot;
    const own = firstOnPage(q, page, ctx);
    if (!own || box.y1 > own.box.y0) return [];
    const earlier = all.some((other) => {
      const first = other === q ? undefined : firstOnPage(other, page, ctx);
      return first !== undefined && first.box.y0 < box.y0;
    });
    if (!earlier) return [];
    return [
      {
        check: 'picture_place',
        question: index,
        lines: [own.id],
        detail: 'A picture sits between two questions; its owner is unclear.',
      },
    ];
  });
}
