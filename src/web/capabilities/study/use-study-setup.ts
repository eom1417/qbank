import { useEffect, useMemo, useState } from 'react';
import type { StudyKind, StudyScope } from '../../../contracts/study.js';
import { previewStudy } from './api.js';

/** The setup's choices and the live count of questions ready in them (FR-03-006, UI-13). */
export function useStudySetup(initialBank: string | null) {
  const [bankIds, setBankIds] = useState<string[]>(initialBank ? [initialBank] : []);
  const [kind, setKind] = useState<StudyKind>('random');
  const [size, setSize] = useState(20);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [available, setAvailable] = useState<number | null>(null);
  const scope = useMemo<StudyScope>(
    () => ({ bankIds, ...(favoritesOnly ? { favoritesOnly } : {}) }),
    [bankIds, favoritesOnly],
  );
  useEffect(() => {
    let active = true;
    setAvailable(null);
    if (scope.bankIds.length > 0)
      previewStudy(scope, kind).then(
        (r) => active && setAvailable(r.available),
        () => active && setAvailable(0),
      );
    return () => {
      active = false;
    };
  }, [scope, kind]);
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
  };
}
