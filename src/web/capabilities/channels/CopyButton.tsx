import { useState } from 'react';
import { Button } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** Copies `text` and says so; the text itself is always shown beside it. */
export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
    >
      {t(copied ? 'sharing.secret.copied' : 'sharing.secret.copy')}
    </Button>
  );
}
