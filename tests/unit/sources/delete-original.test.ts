import { describe, expect, it } from 'vitest';
import type { SourcesDeps } from '../../../src/server/capabilities/sources/use-cases/deps.js';
import { deleteOriginal } from '../../../src/server/capabilities/sources/use-cases/manage-imports.js';

// Q23: the units an import kept for review go with its original, by the use case itself, so
// every caller (not only the HTTP route) erases them.

const SOURCE = '00000000-0000-4000-8000-000000000001';
const actor = { accountId: '00000000-0000-4000-8000-000000000002' };

function fakeDeps(running: boolean) {
  const calls: string[] = [];
  const deps = {
    imports: {
      findSource: async () => ({ id: SOURCE, blob_key: 'blob-1' }),
      runningJobOf: async () => (running ? { id: 'job' } : undefined),
      forgetOriginal: async () => void calls.push('original'),
    },
    blocks: { forgetSource: async (id: string) => void calls.push(`units:${id}`) },
    blobs: { remove: async () => void calls.push('blob') },
  } as unknown as SourcesDeps;
  return { deps, calls };
}

describe('deleting an original (Q23)', () => {
  it('forgets the units kept for review with the original', async () => {
    const { deps, calls } = fakeDeps(false);
    await deleteOriginal(deps, actor, SOURCE);
    expect(calls).toEqual([`units:${SOURCE}`, 'original', 'blob']);
  });

  it('forgets nothing while an import of the source still runs', async () => {
    const { deps, calls } = fakeDeps(true);
    await expect(deleteOriginal(deps, actor, SOURCE)).rejects.toMatchObject({
      code: 'not_retryable',
    });
    expect(calls).toEqual([]);
  });
});
