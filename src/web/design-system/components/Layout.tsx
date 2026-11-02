import type { ReactNode } from 'react';

interface ChildrenProps {
  children: ReactNode;
}

export function Card({ children }: ChildrenProps) {
  return <section className="qb-card">{children}</section>;
}

export function Stack({ children }: ChildrenProps) {
  return <div className="qb-stack">{children}</div>;
}

export function NarrowColumn({ children }: ChildrenProps) {
  return <div className="qb-narrow qb-stack">{children}</div>;
}

/** A wrapping horizontal group: toolbars, action rows, inline forms. */
export function Row({ children }: ChildrenProps) {
  return <div className="qb-row">{children}</div>;
}

export function Grid({ children }: ChildrenProps) {
  return <div className="qb-grid">{children}</div>;
}

export function Heading({ children }: ChildrenProps) {
  return <h1 className="qb-heading">{children}</h1>;
}

export function Title({ children }: ChildrenProps) {
  return <h2 className="qb-title">{children}</h2>;
}

export function MutedText({ children }: ChildrenProps) {
  return <p className="qb-muted">{children}</p>;
}

/** A label that never relies on colour alone: the text carries the meaning. */
export function Badge({ children }: ChildrenProps) {
  return <span className="qb-badge">{children}</span>;
}

export function Subtitle({ children }: ChildrenProps) {
  return <h3 className="qb-subtitle">{children}</h3>;
}
