import { describe, expect, it } from 'vitest';
import {
  compareForLibrary,
  type Bank,
} from '../../../src/server/capabilities/library/domain/bank.js';

const bank = (name: string, updated: string, archived = false): Bank => ({
  id: name,
  ownerId: 'owner',
  name,
  description: null,
  subject: null,
  archivedAt: archived ? new Date('2026-01-01') : null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date(updated),
});

describe('library order', () => {
  it('lists active banks first, most recently updated first, archived last', () => {
    const banks = [
      bank('old', '2026-02-01'),
      bank('archived', '2026-10-01', true),
      bank('recent', '2026-09-01'),
    ];
    expect(banks.sort(compareForLibrary).map((b) => b.name)).toEqual(['recent', 'old', 'archived']);
  });
});
