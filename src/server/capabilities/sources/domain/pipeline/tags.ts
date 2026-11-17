// M34 P4, level 5 (Q53): an exam-and-year label ("Part II 2019", "Part I 2017, 2022") is a
// filter tag of the question, never part of its stem or explanation.

export interface QuestionTags {
  exam: string | null;
  year: string | null;
}

const YEAR = '(?:19|20)\\d{2}';
const YEARS = `${YEAR}(?:\\s*(?:,|&|and|/)\\s*${YEAR})*`;
/** A small closed list of exam names: a part of a board exam, a board, a promotion exam. */
const EXAM = '(?:part\\s+(?:I{1,3}|IV|[1-4])|(?:[A-Z][a-z]+\\s+)?board|promotion)';
const TAG = new RegExp(`\\(?\\b(${EXAM})\\s*[-–:,]?\\s*(${YEARS})\\b\\)?`, 'gi');
/** A line that is only a tag (maybe in brackets). */
const TAG_LINE = new RegExp(
  `^\\s*\\(?\\s*${EXAM}\\s*[-–:,]?\\s*${YEARS}\\s*\\)?\\s*\\.?\\s*$`,
  'i',
);

const tidy = (text: string) => text.replace(/\s{2,}/g, ' ').trim();

/** Normalises an exam name's spacing and case of the part number ("part  ii" → "Part II"). */
const examName = (raw: string) =>
  tidy(raw).replace(/^part\s+(\w+)$/i, (_, part: string) => `Part ${part.toUpperCase()}`);

/** The line is only an exam tag. */
export const isTagLine = (line: string): boolean => TAG_LINE.test(line);

/** The tags written in `text`, and the text without them. */
export function takeTags(text: string): { tags: QuestionTags; rest: string } {
  const exams: string[] = [];
  const years: string[] = [];
  const rest = text.replace(TAG, (_, exam: string, list: string) => {
    exams.push(examName(exam));
    years.push(...list.split(/\s*(?:,|&|and|\/)\s*/i).filter(Boolean));
    return ' ';
  });
  return { tags: mergeTags([], exams, years), rest: tidy(rest) };
}

function mergeTags(base: readonly QuestionTags[], exams: string[], years: string[]): QuestionTags {
  const allExams = [...base.flatMap((tag) => (tag.exam ? [tag.exam] : [])), ...exams];
  const allYears = [...base.flatMap((tag) => (tag.year ? tag.year.split(', ') : [])), ...years];
  const unique = (values: string[]) => [...new Set(values)];
  return {
    exam: allExams.length > 0 ? unique(allExams).join(', ') : null,
    year: allYears.length > 0 ? unique(allYears).join(', ') : null,
  };
}

/** Several tags of one question as one (exams and years each listed once, in order). */
export const combineTags = (tags: readonly QuestionTags[]): QuestionTags => mergeTags(tags, [], []);
