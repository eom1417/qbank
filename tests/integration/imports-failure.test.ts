import { describe, expect, it, vi } from 'vitest';
import type { PageText } from '../../src/server/capabilities/sources/domain/page.js';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

/** Page 2 cannot be read while `brokenPage` is set (a reading tool that crashed). */
const reading = vi.hoisted(() => ({ brokenPage: null as number | null }));

vi.mock('../../src/server/capabilities/sources/adapters/readers.js', async (original) => {
  const real =
    await original<typeof import('../../src/server/capabilities/sources/adapters/readers.js')>();
  return {
    ...real,
    readTextLayer: async (...args: Parameters<typeof real.readTextLayer>) =>
      (await real.readTextLayer(...args)).filter(
        (page: PageText) => page.page !== reading.brokenPage,
      ),
    readScan: (...args: Parameters<typeof real.readScan>) =>
      args[1] === reading.brokenPage
        ? Promise.reject(new Error('reader crashed'))
        : real.readScan(...args),
  };
});

const { app, fixtures } = useImportSuite();

describe('a page that fails to read (FR-23-004, FR-23-005)', () => {
  it('keeps every other page, says which failed, and a retry reads only that page', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    reading.brokenPage = 2;
    const job = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'partial_failure',
      pagesDone: 3,
      questionsFound: 7,
      pages: [{ page: 2, status: 'failed', warning: 'read_failed' }],
    });

    reading.brokenPage = null;
    expect((await owner.post(`/api/imports/${job.id}/retry`, {})).json().stage).toBe('queued');
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'needs_review',
      questionsFound: 8,
      pages: [],
    });
  });
});
