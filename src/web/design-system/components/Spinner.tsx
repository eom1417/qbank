/** A small turning ring: work is under way (M39: the import step that is running). */
export function Spinner({ label }: { label: string }) {
  return <span className="qb-spinner" role="status" aria-label={label} />;
}
