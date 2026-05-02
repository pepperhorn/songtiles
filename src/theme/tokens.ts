import { NOTE_COLORS_LIGHT, NOTE_COLORS_DARK, type PitchClass } from '../constants/noteColors';

export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  canvasBg: string;
  gridDot: string;
  textPrimary: string;
  textSubtle: string;
  tileShadow: string;
  tileBevel: string;
  tilePlayhead: string;
  trayBg: string;
  topBarBg: string;
  noteBg(pc: PitchClass): string;
}

export const LIGHT: ThemeTokens = {
  canvasBg: '#ffffff',
  gridDot: '#e5e5e5',
  textPrimary: '#1f2937',
  textSubtle: '#6b7280',
  tileShadow: 'rgba(0, 0, 0, 0.1)',
  tileBevel: 'rgba(255, 255, 255, 0.5)',
  tilePlayhead: '#3b82f6',
  trayBg: '#f9fafb',
  topBarBg: '#ffffff',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_LIGHT[pc];
  },
};

export const DARK: ThemeTokens = {
  canvasBg: '#1a1a1a',
  gridDot: '#404040',
  textPrimary: '#e5e5e5',
  textSubtle: '#a0a0a0',
  tileShadow: 'rgba(0, 0, 0, 0.3)',
  tileBevel: 'rgba(255, 255, 255, 0.1)',
  tilePlayhead: '#60a5fa',
  trayBg: '#2d2d2d',
  topBarBg: '#1f1f1f',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_DARK[pc];
  },
};

export function tokensFor(mode: ThemeMode): ThemeTokens {
  return mode === 'light' ? LIGHT : DARK;
}
