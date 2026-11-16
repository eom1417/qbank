interface Entry {
  loading: Promise<string | null>;
  url: string | null;
}

/**
 * The attempt's pictures, fetched once with its token and kept as local object addresses (M34
 * U3): the shown question's and the next one's. Those no longer kept are released.
 */
export function pictureCache(
  fetchBlob: (id: string) => Promise<Blob>,
  makeUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
  revoke: (url: string) => void = (url) => URL.revokeObjectURL(url),
) {
  const entries = new Map<string, Entry>();
  const drop = (id: string) => {
    const url = entries.get(id)?.url;
    if (url) revoke(url);
    entries.delete(id);
  };
  const fetchOne = (id: string): Entry => {
    const entry: Entry = { loading: Promise.resolve(null), url: null };
    entry.loading = fetchBlob(id).then(
      (blob) => {
        if (entries.get(id) !== entry) return null;
        entry.url = makeUrl(blob);
        return entry.url;
      },
      () => {
        if (entries.get(id) === entry) entries.delete(id);
        return null;
      },
    );
    return entry;
  };
  return {
    /** The picture's address once it arrived; null while on its way or when it failed. */
    url: (id: string) => entries.get(id)?.url ?? null,
    load(id: string): Promise<string | null> {
      const known = entries.get(id);
      if (known) return known.loading;
      const entry = fetchOne(id);
      entries.set(id, entry);
      return entry.loading;
    },
    /** Keeps only these pictures; the others are released. */
    keep(ids: Iterable<string>) {
      const kept = new Set(ids);
      for (const id of [...entries.keys()]) if (!kept.has(id)) drop(id);
    },
    release() {
      for (const id of [...entries.keys()]) drop(id);
    },
  };
}

export type PictureCache = ReturnType<typeof pictureCache>;
