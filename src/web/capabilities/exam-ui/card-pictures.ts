/** Where a question card's pictures are named, whoever serves the question. */
interface CardPictures {
  pictureIds: readonly string[];
  optionPictureIds: Readonly<Record<string, readonly string[]>>;
  case: { pictures: readonly string[] } | null;
}

/** Every picture a question card shows (M34): the question's, its options' and its case's. */
export const cardPictureIds = (item: CardPictures): string[] => [
  ...(item.case?.pictures ?? []),
  ...item.pictureIds,
  ...Object.values(item.optionPictureIds).flat(),
];
