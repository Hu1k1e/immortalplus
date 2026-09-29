import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'immortalplus.theme';
const ACCENT_KEY = 'immortalplus.accent';
export const DEFAULT_ACCENT = '#e2b742';

/** A handful of curated presets shown as swatches in Settings, in
 * addition to the raw color picker -- default (first) is the original
 * gold this app shipped with. */
export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Gold', value: DEFAULT_ACCENT },
  { name: 'Radiant Green', value: '#51a445' },
  { name: 'Dire Red', value: '#c2352b' },
  { name: 'Azure', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

function currentTheme(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function currentAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* best-effort persistence */ }
}

export function applyAccent(hex: string) {
  document.documentElement.style.setProperty('--accent', hex);
  try { localStorage.setItem(ACCENT_KEY, hex); } catch { /* best-effort persistence */ }
}

/** Reads/writes the app-wide theme + accent color, kept in sync with the
 * bootstrap script in index.html (which applies the saved values before
 * first paint to avoid a flash of the wrong theme). Both are plain CSS
 * custom properties / a `data-theme` attribute on <html>, not React
 * context, so any component can read the *current* value via these
 * getters without needing a provider -- this hook just adds reactivity
 * for the Settings UI that changes them. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => currentTheme());
  const [accent, setAccentState] = useState<string>(() => currentAccent());

  useEffect(() => {
    setThemeState(currentTheme());
    setAccentState(currentAccent());
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);

  const setAccent = useCallback((hex: string) => {
    applyAccent(hex);
    setAccentState(hex);
  }, []);

  return { theme, setTheme, accent, setAccent };
}
