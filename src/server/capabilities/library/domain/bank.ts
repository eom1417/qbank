export interface Bank {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  subject: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Active banks first, then most recently updated (the library's default order). */
export function compareForLibrary(a: Bank, b: Bank): number {
  const archived = Number(a.archivedAt !== null) - Number(b.archivedAt !== null);
  return archived || b.updatedAt.getTime() - a.updatedAt.getTime();
}
