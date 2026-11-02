import type { ReactNode } from 'react';

interface PageShellProps {
  brand: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}

export function PageShell({ brand, actions, children }: PageShellProps) {
  return (
    <div className="qb-shell">
      <header className="qb-shell__bar">
        {brand}
        <nav className="qb-shell__actions">{actions}</nav>
      </header>
      <main className="qb-shell__main">{children}</main>
    </div>
  );
}
