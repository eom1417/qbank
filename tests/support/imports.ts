import { unzipSync } from 'fflate';
import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import { buildPdfFixtures, type PdfFixtures } from './pdf-fixtures.js';
import { ORIGIN, useTestApp } from './test-app.js';

/** A multipart body: the form fields first, then one file, as the upload screen sends it. */
function multipart(fields: Record<string, string>, fileName: string, data: Buffer) {
  const boundary = `----qbank${Date.now().toString(16)}`;
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  const head = `${parts.join('')}--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`;
  const payload = Buffer.concat([Buffer.from(head), data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Uploads `file` into a bank with the browser's session cookie. */
export async function uploadFile(
  app: FastifyInstance,
  cookie: string,
  bankId: string,
  file: string,
  fields: Record<string, string> = {},
) {
  const body = multipart(
    { rightsConfirmed: 'true', ...fields },
    basename(file),
    readFileSync(file),
  );
  return app.inject({
    method: 'POST',
    url: `/api/banks/${bankId}/imports`,
    headers: { origin: ORIGIN, cookie, 'content-type': body.contentType },
    payload: body.payload,
  });
}

/** Runs every queued import now (the app's worker is off in tests). */
export const runImports = (app: FastifyInstance) => app.importWorker.drain();

/** Builds the PDFs once for the current suite file; call the getter inside tests. */
function usePdfFixtures(): () => PdfFixtures {
  let built: PdfFixtures | undefined;
  beforeAll(async () => {
    built = await buildPdfFixtures();
  }, 120_000);
  afterAll(() => built?.cleanup());
  return () => {
    if (!built) throw new Error('PDF fixtures not built');
    return built;
  };
}

/** A test app and the PDF fixtures, for an import suite file. */
export const useImportSuite = (options?: Parameters<typeof useTestApp>[0]) => ({
  app: useTestApp(options),
  fixtures: usePdfFixtures(),
});

/** Stored files of this test process (originals and kept pictures). */
export const blobCount = () => {
  try {
    return readdirSync(`.data/test-app/${process.pid}/blobs`, { recursive: true }).filter(
      (name) => String(name).length > 30,
    ).length;
  } catch {
    return 0;
  }
};

/** Restores an export ZIP as the given browser would upload it (FR-18-005). */
export function restoreZip(app: FastifyInstance, cookie: string, bytes: Uint8Array) {
  const body = multipart({}, 'bank.zip', Buffer.from(bytes));
  return app.inject({
    method: 'POST',
    url: '/api/restore',
    headers: { origin: ORIGIN, cookie, 'content-type': body.contentType },
    payload: body.payload,
  });
}

/** Exports a bank as its owner would download it: the response and the ZIP's files. */
export async function exportZip(app: FastifyInstance, cookie: string, bankId: string, query = '') {
  const response = await app.inject({
    url: `/api/banks/${bankId}/export${query}`,
    headers: { cookie },
  });
  return { response, files: unzipSync(new Uint8Array(response.rawPayload)) };
}
