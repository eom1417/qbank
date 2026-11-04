/** One run of a text comparison: kept, removed (before only) or added (after only). */
export interface DiffSegment {
  kind: 'same' | 'removed' | 'added';
  text: string;
}

/** A before/after comparison in one text: removals struck through, additions marked. */
export function DiffText({ segments }: { segments: readonly DiffSegment[] }) {
  return (
    <p className="qb-diff">
      {segments.map((segment, index) => {
        if (segment.kind === 'removed') return <del key={index}>{segment.text}</del>;
        if (segment.kind === 'added') return <ins key={index}>{segment.text}</ins>;
        return <span key={index}>{segment.text}</span>;
      })}
    </p>
  );
}
