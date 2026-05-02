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
  if (!selected || !start) return null;

  const segs = computeSegments(start, tiles, byCell);
  const seg = segs.find(s => s.tiles.includes(selected));
  if (!seg) return null;

  const cur = settings[seg.rootId] ?? { segmentRootId: seg.rootId, mode: 'sequential' as const, holdBeats: 1 as const };
  const modes: SegmentMode[] = ['sequential', 'solid', 'arp'];

  return (
    <div
      className="detail-panel fixed left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-2xl z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow,
      }}
    >
      <div className="detail-row mb-3">
        <div className="detail-label text-sm opacity-60 mb-1">Mode</div>
        <div className="detail-mode-buttons flex gap-2">
          {modes.map(m => (
            <button
              key={m}
              className={`mode-btn px-3 py-1 rounded-full text-sm ${cur.mode === m ? 'bg-black/10' : ''}`}
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
                className={`hold-btn px-3 py-1 rounded-full text-sm ${cur.holdBeats === h ? 'bg-black/10' : ''}`}
                onClick={() => setHold(seg.rootId, h as 1|2|3|4)}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
