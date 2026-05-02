import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';
import { isEndpoint } from '../graph/adjacency';

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
    if (isEndpoint(id, s.tiles, s.byCell)) s.setStartTile(id);
  }, []);

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
