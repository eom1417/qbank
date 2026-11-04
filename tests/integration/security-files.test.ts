import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';
import { ownerWithBank } from '../support/client.js';
import {
  blobCount,
  restoreZip,
  runImports,
  uploadFile,
  useImportSuite,
} from '../support/imports.js';

// M17.4 findings on untrusted files: picture floods in a restore, and giant pages.
const { app, fixtures } = useImportSuite();

/** A restore of `bankId`'s own export, with every question's pictures set by `pictures`. */
async function restoreCrafted(
  owner: Awaited<ReturnType<typeof ownerWithBank>>['owner'],
  bankId: string,
  pictures: (first: { file: string }) => unknown[],
) {
  const exported = await app().inject({
    url: `/api/banks/${bankId}/export`,
    headers: { cookie: owner.cookie() },
  });
  const files = unzipSync(new Uint8Array(exported.rawPayload));
  const data = JSON.parse(new TextDecoder().decode(files['qbank-export.json']));
  const first = data.questions.flatMap((q: { pictures: { file: string }[] }) => q.pictures)[0];
  for (const question of data.questions) question.pictures = pictures(first);
  const crafted = zipSync({
    'qbank-export.json': strToU8(JSON.stringify(data)),
    [first.file]: files[first.file] as Uint8Array,
  });
  return restoreZip(app(), owner.cookie(), crafted);
}

async function bankWithPictures() {
  const { owner, bankId } = await ownerWithBank(app());
  await uploadFile(app(), owner.cookie(), bankId, fixtures().media);
  await runImports(app());
  return { owner, bankId };
}

describe('untrusted files, after the security review (M17.4)', () => {
  it('stores one copy of a picture however many questions of a restore name it', async () => {
    const { owner, bankId } = await bankWithPictures();
    const before = blobCount();
    const restored = await restoreCrafted(owner, bankId, (first) =>
      Array.from({ length: 20 }, (_, i) => ({ ...first, position: i + 1 })),
    );
    expect(restored.statusCode).toBe(201);
    expect(blobCount() - before).toBe(1);
  });

  it('leaves no half-restored bank or files behind when a restore fails', async () => {
    const { owner, bankId } = await bankWithPictures();
    const before = blobCount();
    // Two pictures in the same place of one question: the database refuses the restore.
    const failed = await restoreCrafted(owner, bankId, (first) => [first, first]);
    expect(failed.statusCode).toBeGreaterThanOrEqual(400);
    expect(blobCount()).toBe(before);
    expect((await owner.get('/api/banks')).json().banks).toHaveLength(1);
  });

  it('refuses a PDF whose page is larger than any book page', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const dir = mkdtempSync(join(tmpdir(), 'qbank-giant-'));
    writeFileSync(
      join(dir, 'page.txt'),
      '%%MediaBox 0 0 5000 5000\nBT /F1 24 Tf 100 100 Td (Giant) Tj ET\n',
    );
    await runTool('mutool', ['create', '-o', join(dir, 'giant.pdf'), join(dir, 'page.txt')]);
    const before = blobCount();
    const refused = await uploadFile(app(), owner.cookie(), bankId, join(dir, 'giant.pdf'));
    expect([refused.statusCode, refused.json().error.code]).toEqual([422, 'page_too_large']);
    expect(blobCount()).toBe(before);
    rmSync(dir, { recursive: true, force: true });
  });
});
