import { useState } from 'react';
import type { ShareSecretResponse } from '../../../contracts/sharing.js';
import type { Preset } from './presets.js';
import { PresetPicker } from './PresetPicker.js';
import { ShareForm } from './ShareForm.js';

interface Props {
  bankId: string;
  onCancel(): void;
  onCreated(created: ShareSecretResponse): void;
}

/** A new share in two steps: pick what kind, then set its rules and publish. */
export function NewShareFlow({ bankId, onCancel, onCreated }: Props) {
  const [preset, setPreset] = useState<Preset | null>(null);
  if (!preset) return <PresetPicker onPick={setPreset} onCancel={onCancel} />;
  return (
    <ShareForm
      key={preset.id}
      bankId={bankId}
      preset={preset}
      onBack={() => setPreset(null)}
      onCreated={onCreated}
    />
  );
}
