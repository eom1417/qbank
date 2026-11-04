import type { Db } from '../../../platform/db/index.js';

interface NewNote {
  id: string;
  ownerId: string;
  questionId: string;
  body: string;
  labels: string[];
  now: Date;
}

/** `%` and `_` in the owner's words are searched for as themselves. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const addNote = (db: Db, note: NewNote) =>
  db
    .insertInto('question_note')
    .values({
      id: note.id,
      owner_id: note.ownerId,
      question_id: note.questionId,
      body: note.body,
      labels: note.labels,
      created_at: note.now,
    })
    .execute();

const notesOf = (db: Db, ownerId: string, questionId: string) =>
  db
    .selectFrom('question_note')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .orderBy('created_at', 'desc')
    .execute();

/** The owner's notes whose text contains the words or that carry them as a label. */
const searchNotes = (db: Db, ownerId: string, query: string) =>
  db
    .selectFrom('question_note')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where((eb) =>
      eb.or([
        eb('body', 'ilike', `%${escapeLike(query)}%`),
        eb(eb.val(query.toLowerCase()), '=', eb.fn.any('labels')),
      ]),
    )
    .orderBy('created_at', 'desc')
    .limit(100)
    .execute();

const deleteNote = async (db: Db, ownerId: string, noteId: string) => {
  const result = await db
    .deleteFrom('question_note')
    .where('owner_id', '=', ownerId)
    .where('id', '=', noteId)
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
};

/** Private review notes on the owner's questions (FR-09-009). */
export function createNoteRepository(db: Db) {
  return {
    addNote: (note: NewNote) => addNote(db, note),
    notesOf: (ownerId: string, questionId: string) => notesOf(db, ownerId, questionId),
    searchNotes: (ownerId: string, query: string) => searchNotes(db, ownerId, query),
    deleteNote: (ownerId: string, noteId: string) => deleteNote(db, ownerId, noteId),
  };
}

export type NoteRepository = ReturnType<typeof createNoteRepository>;
