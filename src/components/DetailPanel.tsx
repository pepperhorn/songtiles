import type { CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { computeSegments } from '../graph/segments';
import type { SegmentMode } from '../graph/types';

export function DetailPanel() {
  const { tokens } = useTheme();
  const selected = useAppStore(s => s.selectedTileId);
  const start = useAppStore(s => s.startTileId);
  const tiles = useAppStore(s => s.tiles);
  const byCell = useAppStore(s => s.byCell);
  const settings = useAppStore(s => s.segmentSettings);
  const setMode = useAppStore(s => s.setSegmentMode);
  const setHold = useAppStore(s => s.setSegmentHold);
  const toggleBass = useAppStore(s => s.toggleBass);
  const selectedTile = useAppStore(s => (s.selectedTileId ? s.tiles[s.selectedTileId] : null));
  if (!selected || !start) return null;

  const segs = computeSegments(start, tiles, byCell);
  const seg = segs.find(s => s.tiles.includes(selected));
  if (!seg) return null;

  const cur = settings[seg.rootId] ?? { segmentRootId: seg.rootId, mode: 'sequential' as const, holdBeats: 1 as const };
  const modes: SegmentMode[] = ['sequential', 'solid', 'arp'];

  const optionBase: CSSProperties = {
    minHeight: 32,
    border: `1px solid ${tokens.gridDot}`,
    color: tokens.textPrimary,
    background: 'transparent',
  };
  const optionSelected: CSSProperties = {
    background: tokens.tilePlayhead,
    color: '#fff',
    border: `1px solid ${tokens.tilePlayhead}`,
  };

  return (
    <div
      className="detail-panel fixed left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-2xl z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow,
      }}
    >
      <button
        type="button"
        className="detail-close absolute top-1.5 right-2 w-8 h-8 grid place-items-center text-xl opacity-60 hover:opacity-100"
        style={{ color: tokens.textPrimary }}
        onClick={() => useAppStore.getState().selectTile(null)}
        aria-label="close detail panel"
      >
        ×
      </button>
      <div className="detail-row mb-3 pr-8">
        <div className="detail-label text-sm opacity-60 mb-1">Mode</div>
        <div className="detail-mode-buttons flex gap-2">
          {modes.map(m => (
            <button
              key={m}
              type="button"
              className="mode-btn px-3 py-1 rounded-full text-sm font-medium"
              style={{ ...optionBase, ...(cur.mode === m ? optionSelected : {}) }}
              onClick={() => setMode(seg.rootId, m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {(cur.mode === 'solid' || cur.mode === 'arp') && (
        <div className="detail-row">
          <div className="detail-label text-sm opacity-60 mb-1">Hold (beats)</div>
          <div className="detail-hold-buttons flex gap-2">
            {[1, 2, 3, 4].map(h => (
              <button
                key={h}
                type="button"
                className="hold-btn px-3 py-1 rounded-full text-sm font-medium"
                style={{ ...optionBase, ...(cur.holdBeats === h ? optionSelected : {}) }}
                onClick={() => setHold(seg.rootId, h as 1|2|3|4)}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
      {selected && selectedTile?.kind === 'note' && (
        <div className="detail-row mt-3">
          <button
            type="button"
            className="bass-toggle px-3 py-1 rounded-full text-sm font-medium"
            style={{
              ...optionBase,
              ...(selectedTile.bass ? optionSelected : {}),
            }}
            onClick={() => toggleBass(selected)}
          >
            {selectedTile.bass ? '↓ Bass on' : 'Flip to bass'}
          </button>
        </div>
      )}
    </div>
  );
}
