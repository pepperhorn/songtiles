import type { CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { computeSegments } from '../graph/segments';
import { midiToPitchClass } from '../constants/noteColors';
import type { Tile } from '../graph/types';

export function DetailPanel() {
  const { tokens } = useTheme();
  const selected = useAppStore(s => s.selectedTileId);
  const start = useAppStore(s => s.startTileId);
  const isPlaying = useAppStore(s => s.isPlaying);
  const tiles = useAppStore(s => s.tiles);
  const byCell = useAppStore(s => s.byCell);
  const paints = useAppStore(s => s.paints);
  const toggleBass = useAppStore(s => s.toggleBass);
  const removeFromPaints = useAppStore(s => s.removeTileFromAllPaints);
  const selectedTile = useAppStore(s => (s.selectedTileId ? s.tiles[s.selectedTileId] : null));
  if (!selected || !start || isPlaying) return null;

  const segs = computeSegments(start, tiles, byCell);
  const seg = segs.find(s => s.tiles.includes(selected));

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

  // Paints this tile belongs to (for the "Remove from paint" affordance).
  const tilePaints = Object.values(paints).filter(p => p.tileIds.includes(selected));

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
      {seg && (
        <div className="detail-scope text-xs opacity-60 mb-3 pr-8">
          {(() => {
            const noteIds = seg.tiles.filter(id => tiles[id]?.kind === 'note');
            const labels = noteIds.slice(0, 4).map(id => {
              const t = tiles[id] as Tile;
              return t.kind === 'note' ? midiToPitchClass(t.pitch) : '';
            });
            const more = noteIds.length > 4 ? ` (+${noteIds.length - 4})` : '';
            return `Segment: ${labels.join(' → ')}${more}`;
          })()}
        </div>
      )}

      {tilePaints.length > 0 && (
        <div className="detail-row mb-3 pr-8">
          <div className="detail-label text-sm opacity-60 mb-1">In paints</div>
          <div className="detail-paint-list flex flex-wrap gap-2">
            {tilePaints.map(p => (
              <span
                key={p.id}
                className="paint-chip text-xs px-2 py-1 rounded-full"
                style={{ ...optionBase, ...optionSelected }}
              >
                {p.kind === 'chord' ? '♬ chord' : '∿ arp'} ({p.tileIds.length})
              </span>
            ))}
          </div>
        </div>
      )}

      {selected && selectedTile?.kind === 'note' && (
        <div className="detail-row flex flex-wrap gap-2 mt-3">
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
          {tilePaints.length > 0 && (
            <button
              type="button"
              className="paint-remove px-3 py-1 rounded-full text-sm font-medium"
              style={optionBase}
              onClick={() => removeFromPaints(selected)}
            >
              Remove from paints
            </button>
          )}
        </div>
      )}
    </div>
  );
}
