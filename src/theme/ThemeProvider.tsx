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
    const stored = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
      ? localStorage.getItem('songtiles.theme')
      : null;

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
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('songtiles.theme', mode);
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
