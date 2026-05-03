import { NOTE_COLORS_LIGHT, NOTE_COLORS_DARK, type PitchClass } from '../constants/noteColors';

export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  canvasBg: string;
  gridDot: string;
  textPrimary: string;
  textSubtle: string;
  /** Outer drop-shadow on tiles (full CSS box-shadow spec). */
  tileShadow: string;
  /** Inset highlight on tiles. */
  tileBevel: string;
  /** Multi-stop text-shadow for the white note label, mirroring dottl's
   *  stroke + soft halo so the letter reads on any tile colour. */
  noteTextShadow: string;
  tilePlayhead: string;
  trayBg: string;
  topBarBg: string;
  /** Wash background for the floating top toolbar strip (sits behind buttons). */
  toolbarStripBg: string;
  noteBg(pc: PitchClass): string;
}

export const LIGHT: ThemeTokens = {
  canvasBg: '#ffffff',
  gridDot: '#e5e5e5',
  textPrimary: '#1f2937',
  textSubtle: '#6b7280',
  tileShadow: '0 2px 6px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.12)',
  tileBevel: 'inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(0, 0, 0, 0.08)',
  noteTextShadow: '0 0 1px rgba(0, 0, 0, 0.65), 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 4px rgba(0, 0, 0, 0.25)',
  tilePlayhead: '#3b82f6',
  trayBg: 'rgba(249, 250, 251, 0.85)',
  topBarBg: 'rgba(255, 255, 255, 0.92)',
  toolbarStripBg: 'rgba(229, 231, 235, 0.8)',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_LIGHT[pc];
  },
};

export const DARK: ThemeTokens = {
  canvasBg: '#1a1a1a',
  gridDot: '#404040',
  textPrimary: '#e5e5e5',
  textSubtle: '#a0a0a0',
  tileShadow: '0 2px 6px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.25)',
  tileBevel: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
  noteTextShadow: '0 0 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.35)',
  tilePlayhead: '#60a5fa',
  trayBg: 'rgba(45, 45, 45, 0.85)',
  topBarBg: 'rgba(40, 40, 40, 0.92)',
  toolbarStripBg: 'rgba(20, 20, 20, 0.8)',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_DARK[pc];
  },
};

export function tokensFor(mode: ThemeMode): ThemeTokens {
  return mode === 'light' ? LIGHT : DARK;
}
