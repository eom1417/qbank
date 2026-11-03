import { describe, expect, it, vi } from 'vitest';
import type { PageText } from '../../src/server/capabilities/sources/domain/page.js';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

/** Pages in `broken` cannot be read (a reading tool that crashed on them). */
const reading = vi.hoisted(() => ({ broken: new Set<number>() }));

vi.mock('../../src/server/capabilities/sources/adapters/readers.js', async (original) => {
  const real =
    await original<typeof import('../../src/server/capabilities/sources/adapters/readers.js')>();
  return {
    ...real,
    readTextLayer: async (...args: Parameters<typeof real.readTextLayer>) =>
      (await real.readTextLayer(...args)).filter(
        (page: PageText) => !reading.broken.has(page.page),
      ),
    readScan: (...args: Parameters<typeof real.readScan>) =>
      reading.broken.has(args[1])
        ? Promise.reject(new Error('reader crashed'))
        : real.readScan(...args),
  };
});

const { app, fixtures } = useImportSuite();

describe('a page that fails to read (FR-23-004, FR-23-005)', () => {
  it('keeps every other page, says which failed, and a retry reads only that page', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    reading.broken = new Set([2]);
    const job = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'partial_failure',
      pagesDone: 3,
      questionsFound: 7,
      pages: [{ page: 2, status: 'failed', warning: 'read_failed' }],
    });

    reading.broken = new Set();
    expect((await owner.post(`/api/imports/${job.id}/retry`, {})).json().stage).toBe('queued');
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'needs_review',
      questionsFound: 8,
      pages: [],
    });
  });
});

describe('the original after a failed or partial import (FR-19-002, UAT-073, DEC-13, DEC-14)', () => {
  const sourceOf = async (owner: Awaited<ReturnType<typeof ownerWithBank>>) =>
    (await owner.owner.get(`/api/banks/${owner.bankId}/sources`)).json().sources[0];

  it('a partly read file keeps its original until the user decides', async () => {
    const owner = await ownerWithBank(app());
    reading.broken = new Set([2]);
    await uploadFile(app(), owner.owner.cookie(), owner.bankId, fixtures().english);
    await runImports(app());
    reading.broken = new Set();
    expect(await sourceOf(owner)).toMatchObject({
      latestImport: { stage: 'partial_failure' },
      hasOriginal: true,
      originalExpiresAt: null,
    });
  });

  it('a file that could not be read at all is kept only for the stated period', async () => {
    const owner = await ownerWithBank(app());
    reading.broken = new Set([1, 2, 3]);
    await uploadFile(app(), owner.owner.cookie(), owner.bankId, fixtures().english);
    await runImports(app());
    reading.broken = new Set();
    const source = await sourceOf(owner);
    expect(source).toMatchObject({ latestImport: { stage: 'failed' }, hasOriginal: true });
    const days = (new Date(source.originalExpiresAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });
});
