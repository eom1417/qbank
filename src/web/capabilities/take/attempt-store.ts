/**
 * The attempt token, kept in this browser per link so a reload or a lost connection resumes
 * the same attempt. It is the person's only key to their answers: nothing else is stored.
 */
type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const keyOf = (link: string) => `qb.take.${link}`;

export function attemptStore(storage: KeyStore) {
  return {
    read: (link: string) => storage.getItem(keyOf(link)),
    keep: (link: string, token: string) => storage.setItem(keyOf(link), token),
    forget: (link: string) => storage.removeItem(keyOf(link)),
  };
}

export type AttemptStore = ReturnType<typeof attemptStore>;
