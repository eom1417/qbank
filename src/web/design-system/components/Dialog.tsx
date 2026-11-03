import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button.js';

interface DialogProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose(): void;
  children: ReactNode;
}

/** A modal panel on the native dialog: focus stays inside, Escape closes it. */
export function Dialog({ open, title, closeLabel, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="qb-dialog" aria-label={title} onClose={onClose}>
      <div className="qb-row qb-dialog__bar">
        <span className="qb-title qb-grow">{title}</span>
        <Button variant="ghost" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      {children}
    </dialog>
  );
}
