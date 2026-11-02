import type { ReactNode } from 'react';

interface AlertProps {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <div className={`qb-alert qb-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  steps?: readonly string[];
  action?: ReactNode;
}

/** Every empty screen explains the next useful step (no zero-only dead ends). */
export function EmptyState({ title, description, steps, action }: EmptyStateProps) {
  return (
    <div className="qb-empty">
      <h2 className="qb-title">{title}</h2>
      <p className="qb-muted">{description}</p>
      {steps && (
        <ol className="qb-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {action}
    </div>
  );
}
