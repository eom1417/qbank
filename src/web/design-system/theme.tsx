import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'qb.theme';
const SKIN_KEY = 'qb.skin';

interface ThemeState {
  theme: ThemePreference;
  setTheme(t: ThemePreference): void;
  /** The look-and-feel skin, applied as `data-skin` on <html> (tokens/skins). */
  skin: string;
  setSkin(skin: string): void;
}

const ThemeContext = createContext<ThemeState>({
  theme: 'system',
  setTheme: () => undefined,
  skin: '',
  setSkin: () => undefined,
});

function readStored(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolve(theme: ThemePreference): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The last skin used on this browser, applied before the first paint so nothing flashes. */
function initialSkin(fallback: string) {
  const skin = localStorage.getItem(SKIN_KEY) ?? fallback;
  document.documentElement.dataset['skin'] = skin;
  return skin;
}

/** Applies theme and skin on <html>; semantic tokens (and the skin's remap) do the rest. */
export function ThemeProvider({
  defaultSkin,
  children,
}: {
  defaultSkin: string;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemePreference>(readStored);
  const [skin, setSkin] = useState(() => initialSkin(defaultSkin));
  useEffect(() => {
    document.documentElement.dataset['theme'] = resolve(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset['skin'] = skin;
    localStorage.setItem(SKIN_KEY, skin);
  }, [skin]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
