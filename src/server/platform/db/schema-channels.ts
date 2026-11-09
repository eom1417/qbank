import type { ColumnType } from 'kysely';

/** A publishing channel (M23, DEC-36): one bank's ready questions for an outside agent. */
interface ChannelTable {
  id: string;
  owner_id: string;
  bank_id: string;
  name: string;
  chapter_ids: ColumnType<string[], string[] | undefined, string[]>;
  batch_size: number;
  when_done: 'restart' | 'stop';
  /** SHA-256 of the channel's key; the key itself is shown once and never stored. */
  key_hash: string;
  /** The key's first characters, to recognise it in the list. */
  key_prefix: string;
  paused: ColumnType<boolean, boolean | undefined, boolean>;
  /** Each question goes out once per cycle; a new cycle starts when all have gone. */
  cycle: ColumnType<number, number | undefined, number>;
  created_at: Date;
  last_used_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** M30 (DEC-39): how the questions travel. */
  kind: ColumnType<'agent' | 'exam' | 'practice', 'agent' | 'exam' | 'practice' | undefined, never>;
  /**
   * The policy parts not held in the columns above (chapter_ids, batch_size, when_done, paused
   * stay the truth for what they hold). Read and written only through the channels repository.
   */
  policy: ColumnType<unknown, string | undefined, string>;
  version: ColumnType<number, number | undefined, number>;
  ended_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  archived_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

interface ChannelBatchTable {
  id: string;
  channel_id: string;
  owner_id: string;
  /** The agent's own name for the batch (e.g. a date): asking again returns the same one. */
  batch_key: string | null;
  cycle: number;
  created_at: Date;
}

interface ChannelDeliveryTable {
  id: string;
  batch_id: string;
  channel_id: string;
  owner_id: string;
  question_id: string;
  cycle: number;
  position: number;
  sent_at: Date;
}

interface ChannelAnswerTable {
  delivery_id: string;
  channel_id: string;
  owner_id: string;
  /** SHA-256 of the agent's name for the recipient: never a phone number or a name. */
  recipient_hash: string;
  choice: string[];
  correct: boolean;
  answered_at: Date;
}

/** A share's append-only record (DEC-39): inserted, never updated. */
interface ChannelEventTable {
  id: string;
  channel_id: string;
  owner_id: string;
  at: Date;
  type: string;
  version: number;
  detail: ColumnType<unknown, string | undefined, never>;
}

/** One person's attempt at an exam or practice share. */
interface ChannelAttemptTable {
  id: string;
  channel_id: string;
  owner_id: string;
  /** The policy version the attempt started under and keeps to its end. */
  version: number;
  /** Null when the share keeps anonymous records. */
  person_name: string | null;
  person_ref: string | null;
  /** SHA-256 of the share and the normalized name and id: counts attempts per person. */
  person_key: string;
  /** SHA-256 of the attempt token; the token itself stays in the person's browser. */
  token_hash: string;
  status: 'active' | 'submitted';
  ended_by: 'person' | 'time' | 'owner' | null;
  position: ColumnType<number, number | undefined, number>;
  total: number;
  correct: number | null;
  started_at: Date;
  deadline_at: Date | null;
  submitted_at: Date | null;
}

interface ChannelAttemptItemTable {
  attempt_id: string;
  position: number;
  channel_id: string;
  owner_id: string;
  question_id: string | null;
  /** The question as it was asked (exam-rules `Snapshot`). */
  snapshot: ColumnType<unknown, string, never>;
  chosen: string[] | null;
  correct: boolean | null;
  flagged: ColumnType<boolean, boolean | undefined, boolean>;
  opened_at: Date | null;
  answered_at: Date | null;
}

export interface ChannelTables {
  channel_event: ChannelEventTable;
  channel_attempt: ChannelAttemptTable;
  channel_attempt_item: ChannelAttemptItemTable;
  channel: ChannelTable;
  channel_batch: ChannelBatchTable;
  channel_delivery: ChannelDeliveryTable;
  channel_answer: ChannelAnswerTable;
}
