/** A bank's chapters and their topics, as the library lists them. */
export interface ChapterNames {
  id: string;
  name: string;
  topics: readonly { id: string; name: string }[];
}

export interface PlaceSuggestion {
  chapterId: string;
  topicId: string | null;
}

const words = (text: string) => text.toLocaleLowerCase().normalize('NFKC');

/** The name appears as whole words in the text (any script). */
function mentions(text: string, name: string): boolean {
  const needle = words(name).trim();
  if (needle.length < 3) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(words(text));
}

/**
 * A chapter and topic for a question from the names the user gave them (FR-08-002): the
 * longest topic name the question mentions wins, else the longest chapter name. Only a
 * suggestion: the user's own choice always stays (M7 edits it).
 */
export function suggestPlace(
  text: string,
  chapters: readonly ChapterNames[],
): PlaceSuggestion | null {
  const topics = chapters
    .flatMap((chapter) => chapter.topics.map((topic) => ({ chapter, topic })))
    .filter(({ topic }) => mentions(text, topic.name))
    .sort((a, b) => b.topic.name.length - a.topic.name.length);
  const best = topics[0];
  if (best) return { chapterId: best.chapter.id, topicId: best.topic.id };
  const chapter = chapters
    .filter((candidate) => mentions(text, candidate.name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return chapter ? { chapterId: chapter.id, topicId: null } : null;
}
