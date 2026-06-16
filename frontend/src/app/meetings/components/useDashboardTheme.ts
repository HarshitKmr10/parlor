'use client';

import { useCallback, useEffect, useState } from 'react';

// Local theme state for the meeting-joiner dashboard. Persists to
// localStorage under a dashboard-specific key so it doesn't fight the
// rest of the app's theming. Falls back to the OS preference on first
// load. Applies / removes the `dark` class on <html> directly so Tailwind
// `dark:` variants pick it up.

const STORAGE_KEY = 'meetings_dashboard_theme';
type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function useDashboardTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initial = readInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const setAndPersist = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — incognito etc.
    }
  }, []);

  const toggle = useCallback(() => {
    setAndPersist(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setAndPersist]);

  return { theme, toggle, setTheme: setAndPersist };
}
