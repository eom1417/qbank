import type { AiProvider } from '../../providers/index.js';
import type { PageText } from '../domain/page.js';
import {
  KEY_LINK_PROMPT,
  KeyLinkReply,
  acceptedLinks,
  keyLinkText,
  type Unanswered,
} from '../domain/triage/key-links.js';
import { askBatch } from './ask-batch.js';
import type { ExtractedQuestion } from './extract-questions.js';

/** Page text per request: enough for a key of a few hundred answers. */
const CHUNK = 15_000;
/** A page with fewer words holds no key. */
const MIN_WORDS = 15;

const pageText = (page: PageText) =>
  `--- page ${page.page}\n${page.words.map((word) => word.text).join(' ')}`;

/** The pages no question was read from, in chunks of text. */
function keyChunks(pages: readonly PageText[], questions: readonly ExtractedQuestion[]) {
  const asked = new Set(questions.map((question) => question.page));
  const chunks: string[] = [];
  let current = '';
  for (const page of pages) {
    if (asked.has(page.page) || page.words.length < MIN_WORDS) continue;
    const text = pageText(page);
    if (current && current.length + text.length > CHUNK) chunks.push(current);
    current = current && current.length + text.length <= CHUNK ? `${current}\n${text}` : text;
  }
  return current ? [...chunks, current] : chunks;
}

/**
 * Organizing (DEC-34): after the AI read the pages one by one, the answers printed on other
 * pages (a key at the end, explanations) are linked to their questions as the file's answers.
 * A failed request leaves the questions as they were; it never stops the import.
 */
export async function linkKeys(
  provider: AiProvider,
  questions: readonly ExtractedQuestion[],
  pages: readonly PageText[],
): Promise<ExtractedQuestion[]> {
  const open: Unanswered[] = questions.flatMap((question, index) =>
    question.kind === 'mcq' && question.answer === null
      ? [
          {
            id: `q${index + 1}`,
            number: question.number,
            stem: question.stem,
            options: question.options,
          },
        ]
      : [],
  );
  const result = [...questions];
  if (open.length === 0) return result;
  for (const chunk of keyChunks(pages, questions)) {
    const reply = await askBatch(provider, {
      name: 'link_answer_pages',
      system: KEY_LINK_PROMPT,
      parts: [{ type: 'text', text: keyLinkText(open, chunk) }],
      schema: KeyLinkReply,
    });
    if (!reply.ok) continue;
    for (const [id, link] of acceptedLinks(reply.value, open, chunk)) {
      const index = Number(id.slice(1)) - 1;
      const question = result[index];
      if (!question || question.answer !== null) continue;
      result[index] = {
        ...question,
        answer: link.letter,
        answers: [link.letter],
        evidence: 'answer_key',
        explanation: question.explanation ?? link.explanation,
      };
    }
  }
  return result;
}
