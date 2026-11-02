import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'qb.theme';
const ThemeContext = createContext<{ theme: ThemePreference; setTheme(t: ThemePreference): void }>({
  theme: 'system',
  setTheme: () => undefined,
});

function readStored(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolve(theme: ThemePreference): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme as `data-theme` on <html>; semantic tokens do the rest. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(readStored);
  useEffect(() => {
    document.documentElement.dataset['theme'] = resolve(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
