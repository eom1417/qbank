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

export interface ChannelTables {
  channel: ChannelTable;
  channel_batch: ChannelBatchTable;
  channel_delivery: ChannelDeliveryTable;
  channel_answer: ChannelAnswerTable;
}
