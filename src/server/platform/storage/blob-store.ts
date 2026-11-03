import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface StoredBlob {
  key: string;
  size: number;
  sha256: string;
}

/**
 * Where uploaded originals live until they are verified and deleted (FR-19-001). The only
 * adapter today is the local disk under QBANK_DATA_DIR; an object store can replace it later.
 */
export interface BlobStore {
  /** Streams `data` to a new blob, stopping (and removing it) past `maxBytes`. */
  put(data: Readable, maxBytes: number): Promise<StoredBlob | 'too_large'>;
  /** A local path the readers (MuPDF, poppler) can open. */
  pathOf(key: string): string;
  remove(key: string): Promise<void>;
}

class TooLarge extends Error {}

export function createDiskBlobStore(dataDir: string): BlobStore {
  const root = resolve(dataDir, 'blobs');
  const pathOf = (key: string) => join(root, key.slice(0, 2), key);
  return {
    async put(data, maxBytes) {
      const key = randomUUID();
      const path = pathOf(key);
      await mkdir(join(root, key.slice(0, 2)), { recursive: true, mode: 0o700 });
      const hash = createHash('sha256');
      let size = 0;
      data.on('data', (chunk: Buffer) => {
        size += chunk.length;
        hash.update(chunk);
        if (size > maxBytes) data.destroy(new TooLarge());
      });
      try {
        await pipeline(data, createWriteStream(`${path}.part`, { mode: 0o600 }));
        await rename(`${path}.part`, path);
      } catch (error) {
        await rm(`${path}.part`, { force: true });
        if (error instanceof TooLarge || size > maxBytes) return 'too_large';
        throw error;
      }
      return { key, size: (await stat(path)).size, sha256: hash.digest('hex') };
    },
    pathOf,
    remove: (key) => rm(pathOf(key), { force: true }),
  };
}

/** Opens a stored blob for reading (e.g. to check its first bytes). */
export const openBlob = (store: BlobStore, key: string) => createReadStream(store.pathOf(key));
