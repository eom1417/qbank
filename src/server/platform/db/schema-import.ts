import type { ColumnType, Generated } from 'kysely';

// M34 (DEC-43): the shared case of several questions, and the import pipeline's temporary tables.

/** A case (vignette) several questions share: shown in full with each of them (Z8). */
interface QuestionCaseTable {
  id: string;
  owner_id: string;
  source_id: string | null;
  text: string;
  created_at: Generated<Date>;
}

/** One passage of an imported page while the pipeline runs; deleted after 7 days. */
interface ImportBlockTable {
  id: string;
  owner_id: string;
  job_id: string;
  page: number;
  ordinal: number;
  kind: string;
  role: string | null;
  text: string | null;
  box: ColumnType<unknown, string, string>;
  expires_at: Generated<Date>;
}

/** A judged AI step, keyed by input + lesson version + model, so it is never paid twice. */
interface AiStepCacheTable {
  key: string;
  owner_id: string;
  lesson: string;
  model: string;
  reply: ColumnType<unknown, string, string>;
  input_tokens: number;
  output_tokens: number;
  expires_at: Generated<Date>;
}

export interface ImportTables {
  question_case: QuestionCaseTable;
  import_block: ImportBlockTable;
  ai_step_cache: AiStepCacheTable;
}
