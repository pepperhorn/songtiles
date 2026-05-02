import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';
import { isEndpoint } from '../graph/adjacency';
import { setCanvasResolver } from '../state/dragController';

const CELL = 96;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

export function Canvas() {
  const { tokens } = useTheme();
  const tiles = useAppStore(s => s.tiles);
  const startTileId = useAppStore(s => s.startTileId);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const panStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const draggedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const DOUBLE_TAP_MS = 300;

  const placedTiles = Object.values(tiles).filter(t => t.cell != null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start pan if the click originated on a tile
    if ((e.target as Element).closest('.songtile')) return;
    draggedRef.current = false;
    panStart.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.px;
    const dy = e.clientY - panStart.current.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggedRef.current = true;
    setPan({
      x: panStart.current.ox + dx,
      y: panStart.current.oy + dy,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    panStart.current = null;
  }, []);

  const handleTileClick = useCallback((id: string) => {
    if (draggedRef.current) return;
    const s = useAppStore.getState();
    const t = s.tiles[id];
    if (!t) return;

    // Double-tap detection: second tap on same tile within 300ms toggles bass
    // (note tiles only). The first tap of the pair has already fired its
    // single-tap actions, which is fine — they're idempotent.
    const now = performance.now();
    const last = lastTapRef.current;
    if (last && last.id === id && now - last.t < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      if (t.kind === 'note') s.toggleBass(id);
      else if (t.kind === 'repeat-open') s.cycleRepeatCount(id);
      return;
    }
    lastTapRef.current = { id, t: now };

    // Single-tap actions: preview pitch, select, halo if endpoint.
    if (t.kind === 'note') s.previewNote(t.pitch);
    s.selectTile(id);
    if (isEndpoint(id, s.tiles, s.byCell)) s.setStartTile(id);
  }, []);

  // Register a resolver so the Tray can ask "what cell is this screen point over?"
  useEffect(() => {
    setCanvasResolver((cx, cy) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return null;
      const worldX = (cx - rect.left - pan.x) / zoom;
      const worldY = (cy - rect.top - pan.y) / zoom;
      return { x: Math.floor(worldX / CELL), y: Math.floor(worldY / CELL) };
    });
    return () => setCanvasResolver(null);
  }, [pan, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.001)));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/songtile-id');
    if (!id) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;
    const cell = { x: Math.floor(worldX / CELL), y: Math.floor(worldY / CELL) };
    useAppStore.getState().placeTileOnCell(id, cell);
  }, [pan, zoom]);

  return (
    <div
      ref={canvasRef}
      className="canvas-root h-screen overflow-hidden relative"
      style={{
        background: tokens.canvasBg,
        touchAction: 'none',
        cursor: panStart.current ? 'grabbing' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* World transform layer */}
      <div
        className="canvas-world absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {placedTiles.map(t => {
          const cell = t.cell!;
          const isStart = t.id === startTileId;
          return (
            <div
              key={t.id}
              className="canvas-tile-wrapper absolute"
              style={{ left: cell.x * CELL, top: cell.y * CELL }}
              onClick={() => handleTileClick(t.id)}
            >
              {isStart && (
                <div
                  className="start-halo absolute pointer-events-none"
                  style={{
                    inset: -6,
                    borderRadius: 18,
                    boxShadow: `0 0 0 3px ${tokens.tilePlayhead}`,
                  }}
                />
              )}
              <Tile tile={t} size={CELL} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
