import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { tokensFor, type ThemeMode, type ThemeTokens } from './tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  tokens: ThemeTokens;
  setMode(mode: ThemeMode): void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize on mount: check localStorage, then OS preference
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
        ? localStorage.getItem('doremino.theme')
        : null;
    } catch {
      stored = null;
    }

    if (stored === 'light' || stored === 'dark') {
      setModeState(stored);
    } else {
      // Follow OS preference
      const prefersDark = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
      setModeState(prefersDark ? 'dark' : 'light');
    }

    setMounted(true);
  }, []);

  // Update document class and localStorage when mode changes
  useEffect(() => {
    if (!mounted) return;

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.add('dark-mode');
      } else {
        root.classList.remove('dark');
        root.classList.remove('dark-mode');
      }
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('doremino.theme', mode);
      }
    } catch {
      // ignore localStorage errors in test/SSR environments
    }
  }, [mode, mounted]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const tokens = tokensFor(mode);

  return (
    <ThemeContext.Provider value={{ mode, tokens, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return context;
}
