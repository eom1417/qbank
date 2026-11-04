import type { ReactNode } from 'react';

/** Text a person copies exactly (a link, a code): left-to-right, monospaced, wraps anywhere. */
export function CodeText({ children }: { children: ReactNode }) {
  return (
    <code dir="ltr" className="qb-code">
      {children}
    </code>
  );
}
