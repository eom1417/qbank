import type { ReactNode } from 'react';
import type { ShareDraft } from './use-share-draft.js';

/** What every group of advanced rules receives: the draft, and its errors in words. */
export interface RuleProps {
  draft: ShareDraft;
  errors: Record<string, string>;
}

/** One of the six questions, as a labelled group of its rules. */
export function RuleGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="qb-stack">
      <legend className="qb-subtitle">{legend}</legend>
      {children}
    </fieldset>
  );
}
