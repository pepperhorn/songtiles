import { useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';
import { resolveCanvasCell } from '../state/dragController';

const SLOT_SIZE = 72;
const DRAG_THRESHOLD = 10;       // px before a press becomes a drag
const FLICK_DISTANCE = 80;       // px horizontal travel for a discard flick
const FLICK_SPEED = 0.4;         // px/ms minimum speed for a flick

interface DragState {
  id: string;
  startX: number;
  startY: number;
  startT: number;
  active: boolean;                // crossed DRAG_THRESHOLD
  curX: number;
  curY: number;
}

export function Tray() {
  const { tokens } = useTheme();
  const tray = useAppStore(s => s.tray);
  const tiles = useAppStore(s => s.tiles);
  const refill = useAppStore(s => s.refillTray);
  const discard = useAppStore(s => s.discardTrayTile);
  const placeTileOnCell = useAppStore(s => s.placeTileOnCell);
  const capacity = useAppStore(s => s.trayCapacity);

  const [ghost, setGhost] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  function attachSlotHandlers(id: string) {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        dragRef.current = {
          id,
          startX: e.clientX,
          startY: e.clientY,
          startT: performance.now(),
          active: false,
          curX: e.clientX,
          curY: e.clientY,
        };
        const el = e.currentTarget as Element & { setPointerCapture?: (id: number) => void };
        el.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
        const d = dragRef.current;
        if (!d || d.id !== id) return;
        d.curX = e.clientX;
        d.curY = e.clientY;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          d.active = true;
        }
        if (d.active) setGhost({ ...d });
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        const d = dragRef.current;
        if (!d || d.id !== id) return;
        const dx = e.clientX - d.startX;
        const dt = performance.now() - d.startT;
        const speed = Math.abs(dx) / Math.max(dt, 1);
        const wasActive = d.active;
        dragRef.current = null;
        setGhost(null);

        // 1. If released over the canvas → try to place.
        if (wasActive) {
          const cell = resolveCanvasCell(e.clientX, e.clientY);
          if (cell) {
            placeTileOnCell(id, cell);
            return;
          }
        }

        // 2. Otherwise, treat as a horizontal flick → discard.
        if (Math.abs(dx) > FLICK_DISTANCE && speed > FLICK_SPEED) {
          discard(id);
        }
        // 3. Otherwise: tap (no-op) or short drag that didn't reach canvas → snap back.
      },
      onPointerCancel: () => {
        dragRef.current = null;
        setGhost(null);
      },
      // Test affordance — the Vitest suite uses dblClick to discard.
      onDoubleClick: () => discard(id),
    };
  }

  const draggedId = ghost?.id;

  return (
    <div
      className="tray-root fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 flex items-center gap-3 overflow-x-auto"
      style={{ background: tokens.trayBg, touchAction: 'none' }}
    >
      {tray.map(id => (
        <button
          key={id}
          className="tray-slot"
          aria-label="tray tile"
          style={{
            opacity: draggedId === id ? 0.3 : 1,
            touchAction: 'none',
          }}
          {...attachSlotHandlers(id)}
        >
          <Tile tile={tiles[id]} size={SLOT_SIZE} />
        </button>
      ))}
      {Array.from({ length: Math.max(0, capacity - tray.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="tray-empty"
          style={{ width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 14, border: `2px dashed ${tokens.gridDot}` }}
        />
      ))}
      <button
        className="tray-refill ml-auto px-4 py-2 rounded-full font-medium"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary }}
        onClick={refill}
      >
        Refill
      </button>

      {ghost && tiles[ghost.id] && (
        <div
          className="drag-ghost fixed pointer-events-none z-50"
          style={{
            left: ghost.curX - SLOT_SIZE / 2,
            top:  ghost.curY - SLOT_SIZE / 2,
          }}
        >
          <Tile tile={tiles[ghost.id]} size={SLOT_SIZE} />
        </div>
      )}
    </div>
  );
}
