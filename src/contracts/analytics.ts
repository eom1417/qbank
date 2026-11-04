import { z } from 'zod';

/**
 * A rate always with what it counts and what it is out of (FR-16-002, FR-21-008, M12.1);
 * `percent` is null when there is nothing to count yet, never a made-up zero.
 */
export const Rate = z
  .object({ part: z.number().int(), whole: z.number().int(), percent: z.number().int().nullable() })
  .strict();
export type Rate = z.infer<typeof Rate>;

/** The library in real numbers (FR-16-001, FR-01-010): ready, not merely extracted. */
export const AnalyticsSummary = z
  .object({
    questions: z
      .object({
        total: z.number().int(),
        detected: z.number().int(),
        needsReview: z.number().int(),
        eligible: z.number().int(),
        excluded: z.number().int(),
        duplicates: z.number().int(),
      })
      .strict(),
    learning: z
      .object({
        new: z.number().int(),
        answered: z.number().int(),
        weak: z.number().int(),
        mastered: z.number().int(),
        due: z.number().int(),
      })
      .strict(),
    /** Right out of answered (accuracy); every graded answer, any session. */
    accuracy: Rate,
    /** Average seconds per answered question and per finished session; null without data. */
    seconds: z
      .object({ perQuestion: z.number().int().nullable(), perSession: z.number().int().nullable() })
      .strict(),
    /** Questions answered wrong that have an open report: maybe the question, not the student (FR-16-009). */
    possibleQuestionProblems: z.number().int(),
  })
  .strict();
export type AnalyticsSummary = z.infer<typeof AnalyticsSummary>;

/** Answers per week, each week's accuracy and whether it is too small to read much into. */
export const TrendResponse = z
  .object({
    weeks: z.array(
      z.object({ weekStart: z.iso.datetime(), accuracy: Rate, smallSample: z.boolean() }).strict(),
    ),
  })
  .strict();
export type TrendResponse = z.infer<typeof TrendResponse>;

/** Every session with its date, banks, result and time (FR-16-006); names are looked up now. */
export const SessionHistoryResponse = z
  .object({
    sessions: z.array(
      z
        .object({
          id: z.uuid(),
          mode: z.enum(['tutor', 'exam']),
          kind: z.string(),
          status: z.enum(['active', 'finished']),
          createdAt: z.iso.datetime(),
          bankIds: z.array(z.uuid()),
          score: Rate,
          accuracy: Rate,
          seconds: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();
export type SessionHistoryResponse = z.infer<typeof SessionHistoryResponse>;

/** Each source's import result, apart from learning (FR-16-007, UAT-067). */
export const ImportQualityResponse = z
  .object({
    sources: z.array(
      z
        .object({
          sourceId: z.uuid(),
          fileName: z.string(),
          found: z.number().int(),
          eligible: z.number().int(),
          needsReview: z.number().int(),
          duplicates: z.number().int(),
          missingAnswers: z.number().int(),
          pictures: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();
export type ImportQualityResponse = z.infer<typeof ImportQualityResponse>;

/** One useful next session, and why (FR-16-010). */
export const SuggestionResponse = z
  .object({
    kind: z.enum(['due', 'weak', 'smart_mix', 'new']).nullable(),
    available: z.number().int(),
  })
  .strict();
export type SuggestionResponse = z.infer<typeof SuggestionResponse>;

/** Search results and how many matched (FR-17-001, FR-17-006, UI-22). */
export const SearchResponse = z
  .object({
    total: z.number().int(),
    results: z.array(
      z
        .object({
          id: z.uuid(),
          bankId: z.uuid(),
          excerpt: z.string(),
          page: z.number().int(),
          number: z.number().int(),
          status: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type SearchResponse = z.infer<typeof SearchResponse>;

/** Search words and filters from the address (FR-17-001, FR-17-006); all optional. */
export const SearchQuery = z
  .object({
    q: z.string().trim().max(200).optional(),
    bankId: z.uuid().optional(),
    chapterId: z.uuid().optional(),
    sourceId: z.uuid().optional(),
    tagId: z.uuid().optional(),
    status: z.enum(['detected', 'needs_review', 'eligible', 'excluded']).optional(),
    flagged: z.enum(['true']).optional(),
    favorite: z.enum(['true']).optional(),
    /** Previously wrong, never answered, due, deferred in review, or with no answer key. */
    review: z.enum(['wrong', 'unanswered', 'due', 'deferred', 'no_answer']).optional(),
  })
  .strict();
export type SearchQuery = z.infer<typeof SearchQuery>;
