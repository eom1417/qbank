import type { AiFailure, AiProvider } from '../../providers/index.js';
import type { MediaLink } from '../domain/media-links.js';
import type { PageText } from '../domain/page.js';
import {
  boxOn,
  optionsAndKey,
  PAGE_READING_PROMPT,
  PageReply,
  snapToRegion,
  textHint,
  type ReadQuestion,
} from '../domain/page-reading.js';
import type { MediaRegion } from '../domain/media-regions.js';
import { pageRegions } from './read-source.js';
import type { ExtractedQuestion } from './extract-questions.js';
import { pageImages } from './suggest-marks.js';

/** One question as the rules would have produced it, with the user's AI as the evidence. */
function toQuestion(page: number, read: ReadQuestion): ExtractedQuestion {
  const { options, answers } = optionsAndKey(read);
  return {
    number: read.number,
    page,
    stem: read.stem,
    kind: options.length === 0 ? 'essay' : 'mcq',
    options,
    answer: answers[0] ?? null,
    answers,
    evidence: answers.length > 0 ? 'ai_suggested' : null,
    conflicts: [],
    multiSelect: answers.length > 1,
    explanation: read.explanation || null,
    spans: [],
  };
}

/**
 * The page's questions and pictures in the import's own shapes, so cropping, screening,
 * duplicates and saving stay exactly as for the rules. `first` is the index of the page's first
 * question in the whole import. A picture the AI located is never `certain`.
 */
function fromPageReply(
  page: PageText,
  reply: PageReply,
  first: number,
  found: readonly MediaRegion[] = [],
) {
  const questions = reply.questions.map((read) => toQuestion(page.page, read));
  const media: MediaLink[] = reply.questions.flatMap((read, index) =>
    read.figures.flatMap((figure) => {
      const box = boxOn(page, figure);
      if (!box) return [];
      const region = snapToRegion(page.page, box, found) ?? {
        page: page.page,
        box,
        kind: figure.kind,
        ppi: null,
      };
      return [{ region, question: first + index, certain: false }];
    }),
  );
  return { questions, media };
}

export type AiReading =
  | { ok: true; questions: ExtractedQuestion[]; media: MediaLink[]; unread: number[] }
  | { ok: false; failure: Exclude<AiFailure, 'invalid_output'> };

/**
 * Every page read by the user's AI, one page image each (with its words as a spelling hint).
 * A page whose reply is not valid is listed in `unread`; a provider that stops (quota, sign-in)
 * ends the whole reading, so the import falls back to the rules and says why. `onPage` keeps
 * the job's lease alive: a long book takes a while.
 */
export async function readWithAi(
  file: string,
  pages: readonly PageText[],
  provider: AiProvider,
  onPage: () => Promise<void>,
): Promise<AiReading> {
  const image = pageImages(file);
  const found = await pageRegions(file, pages).catch(() => [] as MediaRegion[]);
  const reading = {
    questions: [] as ExtractedQuestion[],
    media: [] as MediaLink[],
    unread: [] as number[],
  };
  for (const page of pages) {
    const hint = textHint(page);
    const reply = await provider.generate({
      name: 'page_questions',
      system: PAGE_READING_PROMPT,
      parts: [
        { type: 'image', mediaType: 'image/png', base64: await image(page.page) },
        ...(hint
          ? [
              {
                type: 'text' as const,
                text: `Words found on this page (may be out of order):\n${hint}`,
              },
            ]
          : []),
      ],
      schema: PageReply,
    });
    await onPage();
    if (!reply.ok && reply.failure !== 'invalid_output')
      return { ok: false, failure: reply.failure };
    if (!reply.ok) reading.unread.push(page.page);
    else {
      const read = fromPageReply(page, reply.value, reading.questions.length, found);
      reading.questions.push(...read.questions);
      reading.media.push(...read.media);
    }
  }
  return { ok: true, ...reading };
}
