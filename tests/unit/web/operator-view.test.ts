import { describe, expect, it } from 'vitest';
import type { FeedbackItem, QueueItem } from '../../../src/contracts/operator.js';
import {
  BACKUP_LATE_MS,
  backupHealth,
  openFeedback,
  queueOrder,
  whatsappUrl,
} from '../../../src/web/capabilities/operator/view.js';
import { queueMessage } from '../../../src/web/capabilities/sources/api.js';

const note = (id: string, createdAt: string, closedAt: string | null = null): FeedbackItem => ({
  id,
  accountEmail: 'a@example.test',
  accountName: 'A',
  message: 'm',
  screen: '/help',
  version: '0.1.0',
  createdAt,
  closedAt,
});

const job = (jobId: string, state: QueueItem['state'], since: string): QueueItem => ({
  jobId,
  accountEmail: 'a@example.test',
  pagesTotal: 10,
  pagesDone: 0,
  state,
  since,
});

describe('operator console views (M31, DEC-40)', () => {
  it('shows open notes only, newest first', () => {
    const items = [
      note('old', '2026-11-01T10:00:00.000Z'),
      note('closed', '2026-11-03T10:00:00.000Z', '2026-11-04T10:00:00.000Z'),
      note('new', '2026-11-02T10:00:00.000Z'),
    ];
    expect(openFeedback(items).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('lists running imports before waiting ones, each oldest first', () => {
    const items = [
      job('w2', 'waiting', '2026-11-02T10:00:00.000Z'),
      job('r1', 'running', '2026-11-03T10:00:00.000Z'),
      job('w1', 'waiting', '2026-11-01T10:00:00.000Z'),
    ];
    expect(queueOrder(items).map((item) => item.jobId)).toEqual(['r1', 'w1', 'w2']);
  });

  it('opens WhatsApp with the whole message encoded, link included', () => {
    const url = new URL(whatsappUrl('مرحباً سارة: https://qbank.test/reset-password#token=a&b'));
    expect(url.origin).toBe('https://wa.me');
    expect(url.searchParams.get('text')).toBe(
      'مرحباً سارة: https://qbank.test/reset-password#token=a&b',
    );
  });
});

describe("a waiting import's place in the queue (M31, B2)", () => {
  it('says nothing once the import runs', () => {
    expect(queueMessage('en', null)).toBeNull();
  });

  it('says "yours is next" with nobody ahead', () => {
    expect(queueMessage('ar', 0)).toEqual({ key: 'import.queue.next', n: 0 });
  });

  it('uses the Arabic dual and plural forms', () => {
    expect(queueMessage('ar', 1)?.key).toBe('import.queue.ahead.one');
    expect(queueMessage('ar', 2)?.key).toBe('import.queue.ahead.two');
    expect(queueMessage('ar', 3)?.key).toBe('import.queue.ahead.few');
    expect(queueMessage('ar', 11)?.key).toBe('import.queue.ahead.many');
  });

  it('uses one/other in English, with the count', () => {
    expect(queueMessage('en', 1)?.key).toBe('import.queue.ahead.one');
    expect(queueMessage('en', 4)).toEqual({ key: 'import.queue.ahead.other', n: 4 });
  });
});

describe('backup health for the operator (M32)', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();

  it('warns when no backup has run yet', () => {
    expect(backupHealth(null, now)).toBe('none');
  });

  it('warns when the last backup failed, however recent', () => {
    expect(backupHealth({ at: at(60_000), ok: false, kept: 3 }, now)).toBe('failed');
  });

  it('warns when the last good backup is older than 48 hours', () => {
    expect(backupHealth({ at: at(BACKUP_LATE_MS + 1), ok: true, kept: 7 }, now)).toBe('late');
  });

  it('is fine up to 48 hours after a good backup', () => {
    expect(backupHealth({ at: at(BACKUP_LATE_MS), ok: true, kept: 7 }, now)).toBe('ok');
    expect(backupHealth({ at: at(0), ok: true, kept: 1 }, now)).toBe('ok');
  });
});
