import { z } from 'zod';
import { AnswerProvenance, SavedStudyNote } from '../../../../contracts/questions.js';

/**
 * The export file, version 1 (FR-18-001): one bank with its chapters, tags, sources (never the
 * original files), questions with answers, explanations, notes and pictures. The same schema
 * checks a file brought back for restoring, which is untrusted input (FR-18-005).
 */
const Id = z.string().min(1).max(64);
const Name = z.string().trim().min(1).max(200);
const Text = (max: number) => z.string().max(max);

const ExportQuestion = z
  .object({
    id: Id,
    sourceId: Id,
    page: z.number().int().min(0).max(100000),
    number: z.number().int().min(0).max(100000),
    occurrence: z.number().int().min(1).max(1000),
    seq: z.number().int().min(0).max(1000000),
    kind: z.enum(['mcq', 'essay']),
    stem: Text(5000),
    options: z
      .array(
        z
          .object({ letter: z.string().regex(/^[A-J]$/), label: Text(20), text: Text(2000) })
          .strict(),
      )
      .max(10),
    answers: z.array(z.string().regex(/^[A-J]$/)).max(10),
    provenance: AnswerProvenance,
    evidence: Text(200).nullable(),
    explanation: Text(20000).nullable(),
    updateNote: Text(5000).nullable(),
    multiSelect: z.boolean(),
    /** The AI's study note and what it changed (DEC-34); absent in files made before M20. */
    studyNote: SavedStudyNote.nullable().default(null),
    aiChanges: z
      .array(z.string().regex(/^[a-z_]{1,40}$/))
      .max(20)
      .default([]),
    /** The file's answer the AI overturned, and why (DEC-16, DEC-33). */
    fileAnswer: Text(20).nullable().default(null),
    aiNote: Text(5000).nullable().default(null),
    difficulty: z
      .object({ kind: z.enum(['manual', 'inferred']), value: z.number().int().min(1).max(5) })
      .strict()
      .nullable()
      .default(null),
    chapterId: Id.nullable(),
    topicId: Id.nullable(),
    status: z.enum(['detected', 'needs_review', 'eligible', 'excluded']),
    reasons: z.array(Text(40)).max(30),
    tagIds: z.array(Id).max(50),
    notes: z
      .array(z.object({ body: Text(5000), labels: z.array(Text(40)).max(10) }).strict())
      .max(100),
    pictures: z
      .array(
        z
          .object({
            file: z.string().regex(/^media\/[A-Za-z0-9-]{1,64}\.png$/),
            kind: z.enum(['figure', 'table']),
            page: z.number().int().min(0),
            position: z.number().int().min(0),
            width: z.number().int().min(1).max(20000),
            height: z.number().int().min(1).max(20000),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const ExportFile = z
  .object({
    format: z.literal('qbank-export'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    bank: z
      .object({ name: Name, description: Text(2000).nullable(), subject: Text(200).nullable() })
      .strict(),
    chapters: z
      .array(
        z
          .object({
            id: Id,
            name: Name,
            topics: z.array(z.object({ id: Id, name: Name }).strict()).max(500),
          })
          .strict(),
      )
      .max(500),
    tags: z.array(z.object({ id: Id, name: Name }).strict()).max(2000),
    sources: z
      .array(
        z
          .object({
            id: Id,
            fileName: Name,
            pageCount: z.number().int().min(0).max(10000),
            language: z.enum(['auto', 'ar', 'en', 'mixed']),
            sourceType: Text(40),
          })
          .strict(),
      )
      .max(1000),
    questions: z.array(ExportQuestion).max(50000),
    /** What the file leaves out on purpose (FR-18-006). */
    notIncluded: z.array(Text(60)).max(20),
  })
  .strict();
export type ExportFile = z.infer<typeof ExportFile>;
export type ExportQuestion = z.infer<typeof ExportQuestion>;

/** Left out of every export (FR-18-004, FR-18-006, DEC-15 assumed). */
export const NOT_INCLUDED = [
  'ai_sign_ins_and_keys',
  'original_files',
  'attempt_history',
  'study_reports',
];

export const EXPORT_JSON = 'qbank-export.json';
