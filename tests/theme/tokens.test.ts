import { describe, it, expect } from 'vitest';
import { tokensFor, LIGHT, DARK } from '../../src/theme/tokens';
import type { PitchClass } from '../../src/constants/noteColors';

describe('Theme Tokens', () => {
  it('light and dark modes have different canvasBg values', () => {
    const light = tokensFor('light');
    const dark = tokensFor('dark');
    expect(light.canvasBg).not.toBe(dark.canvasBg);
    expect(light.canvasBg).toBe(LIGHT.canvasBg);
    expect(dark.canvasBg).toBe(DARK.canvasBg);
  });

  it('every pitch class returns a valid color string from noteBg()', () => {
    const pitchClasses: PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const lightTokens = tokensFor('light');
    const darkTokens = tokensFor('dark');

    for (const pc of pitchClasses) {
      const lightColor = lightTokens.noteBg(pc);
      const darkColor = darkTokens.noteBg(pc);

      // Should be a valid hex or rgb string
      expect(lightColor).toMatch(/^#[0-9a-fA-F]{6}$|^rgb\(/);
      expect(darkColor).toMatch(/^#[0-9a-fA-F]{6}$|^rgb\(/);

      // Light and dark colors should differ
      expect(lightColor).not.toBe(darkColor);
    }
  });
});
