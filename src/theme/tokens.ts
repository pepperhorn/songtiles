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
  // Warm cream paper. Slightly desaturated yellow keeps it lively but quiet.
  canvasBg: '#faf3e7',
  gridDot: '#e7dec9',
  textPrimary: '#2a2826',
  textSubtle: '#6b6356',
  // Tiles get a chunky offset hard shadow (no blur) so they look stuck onto
  // the page like trading cards. Subtle bevel highlight on top.
  tileShadow: '3px 3px 0 0 #2a2826',
  tileBevel: 'inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -2px 0 rgba(0, 0, 0, 0.08)',
  noteTextShadow: '0 0 1px rgba(0, 0, 0, 0.6), 0 2px 0 rgba(0, 0, 0, 0.18)',
  tilePlayhead: '#ff5b4a',
  trayBg: '#f0e6d2',
  topBarBg: '#fff8eb',
  toolbarStripBg: 'rgba(255, 248, 235, 0.78)',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_LIGHT[pc];
  },
};

export const DARK: ThemeTokens = {
  // Deep midnight navy with a hint of indigo.
  canvasBg: '#0e1421',
  gridDot: '#243047',
  textPrimary: '#f5efe1',
  textSubtle: '#9ba8bd',
  tileShadow: '3px 3px 0 0 #07090f',
  tileBevel: 'inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -2px 0 rgba(0, 0, 0, 0.4)',
  noteTextShadow: '0 0 1px rgba(0, 0, 0, 0.6), 0 2px 0 rgba(0, 0, 0, 0.4)',
  tilePlayhead: '#ffb454',
  trayBg: '#161e30',
  topBarBg: '#19233a',
  toolbarStripBg: 'rgba(17, 24, 39, 0.78)',
  noteBg(pc: PitchClass): string {
    return NOTE_COLORS_DARK[pc];
  },
};

export function tokensFor(mode: ThemeMode): ThemeTokens {
  return mode === 'light' ? LIGHT : DARK;
}
