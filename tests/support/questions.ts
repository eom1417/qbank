import { randomUUID } from 'node:crypto';
import type { Db } from '../../src/server/platform/db/index.js';
import type { createClient } from './client.js';
import { useTestApp } from './test-app.js';

type Browser = ReturnType<typeof createClient>;

/** A question as a test describes it; the rest is a complete, eligible MCQ from the source. */
export interface SeedQuestion {
  stem?: string;
  options?: { letter: string; label: string; text: string }[];
  answers?: string[];
  provenance?: 'source' | 'manual' | 'ai_suggested' | 'conflict' | 'missing';
  status?: 'detected' | 'needs_review' | 'eligible' | 'excluded';
  reasons?: string[];
}

const OPTIONS = ['A', 'B', 'C', 'D'].map((letter) => ({
  letter,
  label: `${letter}.`,
  text: `Option ${letter}`,
}));

/** The seeded questions' source file (no stored original). */
async function seedSource(db: Db, ownerId: string, bankId: string) {
  const sourceId = randomUUID();
  await db
    .insertInto('source')
    .values({
      id: sourceId,
      owner_id: ownerId,
      bank_id: bankId,
      file_name: 'seeded.pdf',
      byte_size: 1,
      sha256: sourceId.replaceAll('-', ''),
      blob_key: null,
      page_count: 10,
      page_from: 1,
      page_to: 10,
      language: 'en',
      source_type: 'question_bank',
      created_at: new Date(),
    })
    .execute();
  return sourceId;
}

/** An import records each question's first version; so does seeding. */
async function seedFirstVersions(
  db: Db,
  ownerId: string,
  ids: string[],
  snapshots: string[],
  now: Date,
) {
  await db
    .insertInto('question_version')
    .values(
      ids.map((id, seq) => ({
        question_id: id,
        version: 1,
        owner_id: ownerId,
        snapshot: snapshots[seq] ?? '{}',
        origin: 'import',
        created_at: now,
      })),
    )
    .execute();
}

/** Saves questions straight into the test database, as an import would, in one new source. */
export async function seedQuestions(
  db: Db,
  owner: Browser,
  bankId: string,
  questions: readonly SeedQuestion[],
): Promise<string[]> {
  const ownerId = (await owner.get('/api/auth/me')).json().id as string;
  const sourceId = await seedSource(db, ownerId, bankId);
  const now = new Date();
  const ids = questions.map(() => randomUUID());
  const snapshots: string[] = [];
  for (const [seq, question] of questions.entries()) {
    const answers = question.answers ?? ['B'];
    const content = {
      kind: 'mcq' as const,
      stem: question.stem ?? `Seeded question ${seq + 1}?`,
      options: question.options ?? OPTIONS,
      answer_letters: answers,
      answer_provenance: question.provenance ?? 'source',
      answer_evidence: null,
      explanation: null,
      multi_select: answers.length > 1,
      chapter_id: null,
      topic_id: null,
      status: question.status ?? 'eligible',
      review_reasons: question.reasons ?? [],
      update_note: null,
    };
    snapshots.push(JSON.stringify(content));
    await db
      .insertInto('question')
      .values({
        id: ids[seq] ?? randomUUID(),
        owner_id: ownerId,
        bank_id: bankId,
        source_id: sourceId,
        source_page: 1 + Math.floor(seq / 5),
        source_number: seq + 1,
        source_seq: seq,
        ...content,
        options: JSON.stringify(content.options),
        answer_letter: answers[0] ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
  await seedFirstVersions(db, ownerId, ids, snapshots, now);
  return ids;
}

/** A test app for review suites, with a seeding shortcut bound to its database. */
export function useReviewSuite() {
  const app = useTestApp();
  const seed = (owner: Browser, bankId: string, questions: readonly SeedQuestion[]) =>
    seedQuestions(app.db(), owner, bankId, questions);
  return { app, seed };
}
