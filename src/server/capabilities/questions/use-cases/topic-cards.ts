import { SavedStudyNote, type TopicCardsResponse } from '../../../../contracts/questions.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { QuestionRepository } from '../adapters/question-repository.js';

interface CardDeps {
  questions: Pick<QuestionRepository, 'topicCardsOf'>;
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
}

type Option = TopicCardsResponse['cards'][number]['options'][number];

/** The bank's topic cards (DEC-34): only the owner's bank; another's is the neutral not-found. */
export async function topicCards(
  deps: CardDeps,
  actor: Actor,
  bankId: string,
): Promise<TopicCardsResponse> {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  const rows = await deps.questions.topicCardsOf(actor.accountId, bankId);
  const cards = rows.flatMap((row) => {
    const note = SavedStudyNote.safeParse(row.study_note);
    if (!note.success) return [];
    const options = (row.options as Option[]).map(({ letter, label, text }) => ({
      letter,
      label,
      text,
    }));
    return [{ id: row.id, stem: row.stem, options, answers: row.answer_letters, note: note.data }];
  });
  return { cards };
}
