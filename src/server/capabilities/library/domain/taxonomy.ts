/** Bank → chapter → topic, plus account-wide tags. Questions may stay unclassified (FR-03-003). */
interface Topic {
  id: string;
  name: string;
}

export interface Chapter {
  id: string;
  name: string;
  position: number;
  topics: Topic[];
}

export interface Tag {
  id: string;
  name: string;
}

/** Chapters keep the order they were added in; a new one goes last. */
export const nextPosition = (chapters: readonly Pick<Chapter, 'position'>[]): number =>
  chapters.reduce((max, chapter) => Math.max(max, chapter.position), 0) + 1;
