import type { SourcesDeps } from './deps.js';

/** A source as an export carries it: what it was, never the original file (FR-18-001). */
export interface PortableSource {
  id: string;
  fileName: string;
  pageCount: number;
  language: 'auto' | 'ar' | 'en' | 'mixed';
  sourceType: string;
}

/** The bank's sources for an export, without their stored originals. */
export async function sourcesOfBank(
  deps: SourcesDeps,
  ownerId: string,
  bankId: string,
): Promise<PortableSource[]> {
  const rows = await deps.imports.sourcesOfBank(ownerId, bankId);
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    pageCount: row.page_count,
    language: row.language,
    sourceType: row.source_type,
  }));
}

/** The stored originals of a bank's sources, to erase their files when the bank is deleted. */
export async function originalsOfBank(deps: SourcesDeps, ownerId: string, bankId: string) {
  const rows = await deps.imports.sourcesOfBank(ownerId, bankId);
  return rows.flatMap((row) => (row.blob_key ? [row.blob_key] : []));
}

/**
 * Recreates a source from an export (FR-18-005): its name and pages, no original file, and a
 * completed import, so it shows like any other. Returns the new ids by the export's ids.
 */
export async function restoreSources(
  deps: SourcesDeps,
  ownerId: string,
  bankId: string,
  sources: readonly PortableSource[],
) {
  const ids = new Map<string, string>();
  const now = deps.clock.now();
  for (const source of sources) {
    const id = deps.newId();
    const created = await deps.imports.create(
      {
        id,
        owner_id: ownerId,
        bank_id: bankId,
        file_name: source.fileName.slice(0, 255),
        byte_size: 0,
        sha256: `restored:${id}`,
        blob_key: null,
        page_count: source.pageCount,
        page_from: 1,
        page_to: Math.max(1, source.pageCount),
        language: source.language,
        source_type: source.sourceType,
        created_at: now,
        answers_for_source_id: null,
        original_expires_at: null,
      },
      {
        id: deps.newId(),
        owner_id: ownerId,
        source_id: id,
        stage: 'completed',
        pages_total: source.pageCount,
        ai_provider_id: null,
        ai_model: null,
        created_at: now,
        updated_at: now,
      },
    );
    if (created === 'created') ids.set(source.id, id);
  }
  return ids;
}
