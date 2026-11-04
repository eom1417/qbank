import { useEffect, useMemo, useState } from 'react';
import type {
  MixShares,
  PreviewResponse,
  StudyKind,
  StudyScope,
} from '../../../contracts/study.js';

import { previewStudy } from './api.js';
import type { TimingKind } from './ExamOptions.js';

/** Smart Mix's announced default (FR-14-001, DEC-10 assumed). */
export const DEFAULT_SHARES: MixShares = { new: 50, weak: 30, due: 20 };

/** The live count of questions ready in a choice, and Smart Mix's groups (FR-03-006). */
function usePreview(scope: StudyScope, kind: StudyKind) {
  const [groups, setGroups] = useState<PreviewResponse['groups'] | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (scope.bankIds.length > 0)
      previewStudy(scope, kind).then(
        (r) => {
          if (!active) return;
          setAvailable(r.available);
          setGroups(r.groups ?? null);
        },
        () => active && setAvailable(0),
      );
    return () => {
      active = false;
    };
  }, [scope, kind]);
  return { available: scope.bankIds.length > 0 ? available : null, groups };
}

/** The setup's choices and the live count of questions ready in them (FR-03-006, UI-13). */
export function useStudySetup(initialBank: string | null) {
  const [bankIds, setBankIds] = useState<string[]>(initialBank ? [initialBank] : []);
  const [kind, setKind] = useState<StudyKind>('random');
  const [size, setSize] = useState(20);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mode, setMode] = useState<'tutor' | 'exam'>('tutor');
  const [timing, setTiming] = useState<TimingKind>('none');
  const [amount, setAmount] = useState(30);
  const [shares, setShares] = useState<MixShares>(DEFAULT_SHARES);
  const scope = useMemo<StudyScope>(
    () => ({ bankIds, ...(favoritesOnly ? { favoritesOnly } : {}) }),
    [bankIds, favoritesOnly],
  );
  const { available, groups } = usePreview(scope, kind);
  const toggleBank = (id: string) =>
    setBankIds((all) => (all.includes(id) ? all.filter((b) => b !== id) : [...all, id]));
  return {
    bankIds,
    toggleBank,
    kind,
    setKind,
    size,
    setSize,
    favoritesOnly,
    setFavoritesOnly,
    available,
    scope,
    mode,
    setMode,
    timing,
    setTiming,
    amount,
    setAmount,
    shares,
    setShares,
    groups,
  };
}
