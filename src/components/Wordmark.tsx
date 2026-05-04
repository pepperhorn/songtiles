import { useTheme } from '../theme/ThemeProvider';

/**
 * Cardboard-arcade wordmark for Doremino. Each letter is its own little
 * tile-shaped chip with a chunky offset shadow, set on a slight tilt so the
 * row looks hand-laid. The whole row sways gently — it's the brand having a
 * good time.
 */
const LETTERS: Array<{ ch: string; tilt: number; bg: string; fg: string }> = [
  { ch: 'D', tilt: -3,  bg: '#ff5b4a', fg: '#fff8eb' },  // tomato red
  { ch: 'O', tilt:  2,  bg: '#ffb454', fg: '#2a2826' },  // amber
  { ch: 'R', tilt: -2,  bg: '#7ed957', fg: '#2a2826' },  // lime
  { ch: 'E', tilt:  3,  bg: '#4cc9f0', fg: '#0e1421' },  // sky
  { ch: 'M', tilt: -1.5, bg: '#a06cd5', fg: '#fff8eb' }, // violet
  { ch: 'I', tilt:  2.5, bg: '#ff8fab', fg: '#2a2826' }, // pink
  { ch: 'N', tilt: -2.5, bg: '#ffd166', fg: '#2a2826' }, // butter
  { ch: 'O', tilt:  1.5, bg: '#06d6a0', fg: '#0e1421' }, // mint
];

export function Wordmark() {
  useTheme();
  return (
    <div
      className="wordmark wordmark-sway flex items-center"
      aria-label="Doremino"
      style={{ pointerEvents: 'none', gap: '2px' }}
    >
      {LETTERS.map((l, i) => (
        <span
          key={i}
          className="wordmark-letter"
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 26,
            height: 30,
            borderRadius: 6,
            background: l.bg,
            color: l.fg,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.04em',
            border: '2px solid var(--chunky-edge)',
            boxShadow: '2px 2px 0 0 var(--chunky-edge)',
            transform: `rotate(${l.tilt}deg)`,
            textShadow: l.fg === '#fff8eb' ? '0 1px 0 rgba(0,0,0,0.25)' : 'none',
          }}
        >
          {l.ch}
        </span>
      ))}
    </div>
  );
}
