import { useState } from 'react';
import { Button } from './Button.js';

interface ConfirmButtonProps {
  label: string;
  confirmLabel: string;
  onConfirm(): void;
  busy?: boolean;
}

/**
 * Destructive actions take two deliberate clicks: the first arms the button and changes its
 * text, the second performs the action (FR-21-004). Leaving the button disarms it.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  busy = false,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={armed ? 'danger' : 'secondary'}
      busy={busy}
      onBlur={() => setArmed(false)}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
