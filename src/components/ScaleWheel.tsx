import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  items: string[];
  selected: number;
  onChange(index: number): void;
}

const ITEM_HEIGHT = 36;
const VISIBLE_COUNT = 5;     // odd → middle slot is the selection

/**
 * Touch-capable scroll wheel for picking a scale root. Items snap to the
 * centre slot via CSS scroll-snap; on scroll-end we resolve the closest
 * item from scrollTop and call onChange. The flanking slots fade out so
 * the selection clearly reads.
 */
export function ScaleWheel({ items, selected, onChange }: Props) {
  const { tokens } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(selected);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external selection → scroll position.
  useEffect(() => {
    if (!ref.current) return;
    const target = selected * ITEM_HEIGHT;
    if (Math.abs(ref.current.scrollTop - target) > 2) {
      ref.current.scrollTo({ top: target, behavior: 'smooth' });
    }
    setActive(selected);
  }, [selected]);

  const onScroll = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
    setActive(idx);
    // Debounce: after the scroll settles, snap and notify.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!ref.current) return;
      const finalIdx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, finalIdx));
      if (clamped !== selected) onChange(clamped);
    }, 90);
  };

  const padHeight = (ITEM_HEIGHT * (VISIBLE_COUNT - 1)) / 2;

  return (
    <div
      className="scale-wheel relative"
      style={{
        width: 96,
        height: ITEM_HEIGHT * VISIBLE_COUNT,
        border: '2px solid var(--chunky-edge)',
        borderRadius: 12,
        background: tokens.canvasBg,
        boxShadow: '2px 2px 0 0 var(--chunky-edge)',
        overflow: 'hidden',
      }}
    >
      {/* Centre selection bar */}
      <div
        className="scale-wheel-bar absolute pointer-events-none"
        style={{
          top: padHeight,
          left: 4,
          right: 4,
          height: ITEM_HEIGHT,
          background: 'rgba(6, 214, 160, 0.18)',
          borderTop: '1.5px solid rgba(6, 214, 160, 0.7)',
          borderBottom: '1.5px solid rgba(6, 214, 160, 0.7)',
          borderRadius: 4,
        }}
      />
      <div
        ref={ref}
        className="scale-wheel-track h-full overflow-y-auto"
        style={{
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
          // Hide scrollbar
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingTop: padHeight,
          paddingBottom: padHeight,
          maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
        }}
        onScroll={onScroll}
      >
        {items.map((label, i) => {
          const dist = Math.abs(i - active);
          return (
            <div
              key={i}
              className="scale-wheel-item grid place-items-center select-none"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: dist === 0 ? 800 : 600,
                fontSize: dist === 0 ? 22 : 18,
                opacity: dist === 0 ? 1 : Math.max(0.18, 0.7 - dist * 0.18),
                color: tokens.textPrimary,
                transition: 'opacity 120ms, font-size 120ms, font-weight 120ms',
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
