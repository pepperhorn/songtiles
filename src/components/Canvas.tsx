import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';
import { isEndpoint } from '../graph/adjacency';
import { setCanvasResolver, isOverTray } from '../state/dragController';
import { computeSegments, findPositionalRepeatPairs } from '../graph/segments';
import type { TileId } from '../graph/types';

const CELL = 96;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

export function Canvas() {
  const { tokens } = useTheme();
  const tiles = useAppStore(s => s.tiles);
  const byCell = useAppStore(s => s.byCell);
  const startTileId = useAppStore(s => s.startTileId);
  const selectedTileId = useAppStore(s => s.selectedTileId);
  const paints = useAppStore(s => s.paints);
  const paintTool = useAppStore(s => s.paintTool);
  const paintingTileIds = useAppStore(s => s.paintingTileIds);
  const activeTiles = useAppStore(s => s.activeTiles);
  const isPlaying = useAppStore(s => s.isPlaying);

  // Paint-stroke colours
  const PAINT_GREEN = '#22c55e';
  const PAINT_CHORD = '#3b82f6';   // blue
  const PAINT_ARP = '#a855f7';     // purple
  const PAINT_BOTH = '#ec4899';    // bright magenta-purple

  // Index tile ids → set of paint kinds for quick badge rendering.
  const tilePaintKinds = (() => {
    const map = new Map<TileId, Set<'chord'|'arp'>>();
    for (const p of Object.values(paints)) {
      for (const tid of p.tileIds) {
        const set = map.get(tid) ?? new Set();
        set.add(p.kind);
        map.set(tid, set);
      }
    }
    return map;
  })();
  const paintingSet = new Set(paintingTileIds);

  // Repeat sections (visual): pair repeats positionally — same row/col with
  // no gaps. Uses the shared helper so playback honours the same pairs.
  const positionalPairs = findPositionalRepeatPairs(tiles, byCell);
  const repeatSectionTiles = (() => {
    const out = new Set<TileId>();
    for (const p of positionalPairs) for (const id of p.lineIds) out.add(id);
    return out;
  })();
  // Per-repeat-tile side ('open' | 'close') for the SVG. Paired tiles use
  // their pair role. Unpaired tiles snap so their dots face the adjacent
  // strand neighbour (right/down → 'open'; left/up → 'close').
  const repeatSideById = (() => {
    const map = new Map<TileId, 'open' | 'close'>();
    for (const p of positionalPairs) {
      map.set(p.openId, 'open');
      map.set(p.closeId, 'close');
    }
    for (const t of Object.values(tiles)) {
      if (t.kind !== 'repeat' || !t.cell || map.has(t.id)) continue;
      const c = t.cell;
      const has = (dx: number, dy: number) => !!byCell[`${c.x + dx},${c.y + dy}`];
      // Prefer the strand direction the tile sits on (one neighbour expected).
      if (has(1, 0))      map.set(t.id, 'open');   // neighbour to the right
      else if (has(0, 1)) map.set(t.id, 'open');   // neighbour below (with v rot, dots face down)
      else if (has(-1, 0)) map.set(t.id, 'close'); // neighbour to the left
      else if (has(0, -1)) map.set(t.id, 'close'); // neighbour above (with v rot, dots face up)
    }
    return map;
  })();

  // Per-tile orientation for repeat glyphs: vertical if the tile's only
  // neighbour is above or below (vertical strand), horizontal otherwise.
  const repeatOrientation = (id: TileId): 'h' | 'v' => {
    const t = tiles[id];
    if (!t?.cell) return 'h';
    const c = t.cell;
    const has = (dx: number, dy: number) => !!byCell[`${c.x + dx},${c.y + dy}`];
    const horiz = has(1, 0) || has(-1, 0);
    const vert = has(0, 1) || has(0, -1);
    return !horiz && vert ? 'v' : 'h';
  };

  // Compute the set of tile ids in the same segment as the currently-selected
  // tile so the canvas can outline them as the "scope" of the detail panel's
  // mode/hold/bass controls. Empty set when nothing's selected.
  const highlightedSegment = (() => {
    if (!selectedTileId || !startTileId) return new Set<string>();
    const segs = computeSegments(startTileId, tiles, byCell);
    const seg = segs.find(s => s.tiles.includes(selectedTileId));
    return new Set(seg?.tiles ?? []);
  })();

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Pinch-zoom: track every active pointer on the canvas root, and when 2 are
  // down compute zoom + pan so the midpoint between the fingers stays fixed.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDist: number;
    startMid: { x: number; y: number };
    startZoom: number;
    startPan: { x: number; y: number };
  } | null>(null);

  const panStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const draggedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const DOUBLE_TAP_MS = 300;
  const LONG_PRESS_MS = 450;

  // Wiggle/drag-off-canvas state. When non-null, the user has long-pressed an
  // endpoint tile and is now in "deletion drag" mode.
  const [wiggle, setWiggle] = useState<{ id: string; x: number; y: number } | null>(null);

  const placedTiles = Object.values(tiles).filter(t => t.cell != null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Track pointer for pinch detection regardless of target — a second finger
    // landing on a tile should still register and start a pinch.
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      // Begin pinch.
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const startDist = Math.hypot(dx, dy);
      pinchRef.current = {
        startDist: Math.max(1, startDist),
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        startZoom: zoom,
        startPan: { ...pan },
      };
      panStart.current = null;
      return;
    }
    // Single pointer: start pan unless it's on a tile.
    if ((e.target as Element).closest('[data-tile-id]')) return;
    draggedRef.current = false;
    panStart.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [pan, zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // Active pinch: re-derive zoom + pan from the two pointers.
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const start = pinchRef.current;
      let nextZoom = (start.startZoom * dist) / start.startDist;
      nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
      // Keep the original midpoint (in screen space) fixed under the fingers
      // by adjusting pan to compensate for the zoom-around-origin transform.
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const k = nextZoom / start.startZoom;
        const localMidX = start.startMid.x - rect.left;
        const localMidY = start.startMid.y - rect.top;
        const nextPanX = localMidX - k * (localMidX - start.startPan.x);
        const nextPanY = localMidY - k * (localMidY - start.startPan.y);
        setPan({ x: nextPanX, y: nextPanY });
      }
      setZoom(nextZoom);
      draggedRef.current = true; // suppress tap-to-deselect after pinch
      return;
    }
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.px;
    const dy = e.clientY - panStart.current.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggedRef.current = true;
    setPan({
      x: panStart.current.ox + dx,
      y: panStart.current.oy + dy,
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    // Tap on empty canvas (no pan, no tile) → deselect to dismiss the detail panel.
    if (panStart.current && !draggedRef.current) {
      useAppStore.getState().selectTile(null);
    }
    panStart.current = null;
  }, []);

  // Long-press → wiggle → drag. State lives in a ref so it survives re-renders
  // (setWiggle re-renders the canvas, which would otherwise wipe closure-state).
  // On release: drop on tray → return-to-tray; drop on canvas at a different
  // valid cell → move tile; otherwise snap back.
  const lpRef = useRef<{
    id: string;
    timer: number | null;
    startXY: { x: number; y: number } | null;
    captured: boolean;
  } | null>(null);

  const cellFromClient = useCallback((cx: number, cy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return null;
    const worldX = (cx - rect.left - pan.x) / zoom;
    const worldY = (cy - rect.top - pan.y) / zoom;
    return { x: Math.floor(worldX / CELL), y: Math.floor(worldY / CELL) };
  }, [pan, zoom]);

  const attachLongPressDragOff = useCallback((id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const cx = e.clientX, cy = e.clientY;
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      const state = { id, timer: null as number | null, startXY: { x: cx, y: cy }, captured: false };
      lpRef.current = state;
      state.timer = window.setTimeout(() => {
        if (!lpRef.current || lpRef.current.id !== id) return;
        lpRef.current.timer = null;
        // Allow long-press on ANY placed tile (not just endpoints) — drop logic
        // decides what's a valid destination.
        lpRef.current.captured = true;
        try { target.setPointerCapture?.(pointerId); } catch { /* ignored */ }
        setWiggle({ id, x: cx, y: cy });
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const lp = lpRef.current;
      if (!lp || lp.id !== id) return;
      if (lp.timer && lp.startXY) {
        const dx = Math.abs(e.clientX - lp.startXY.x);
        const dy = Math.abs(e.clientY - lp.startXY.y);
        if (dx > 6 || dy > 6) {
          window.clearTimeout(lp.timer);
          lp.timer = null;
          lp.startXY = null;
        }
        return;
      }
      if (lp.captured) {
        setWiggle({ id, x: e.clientX, y: e.clientY });
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const lp = lpRef.current;
      if (!lp || lp.id !== id) return;
      if (lp.timer) { window.clearTimeout(lp.timer); lp.timer = null; }
      const wasCaptured = lp.captured;
      lpRef.current = null;
      if (!wasCaptured) return;

      const s = useAppStore.getState();
      if (isOverTray(e.clientX, e.clientY)) {
        // Tray return only if removing the tile keeps the graph connected
        // (endpoints + isolated tiles only).
        s.returnTileFromCanvas(id);
      } else {
        const targetCell = cellFromClient(e.clientX, e.clientY);
        if (targetCell) s.moveTileOnCanvas(id, targetCell);
      }
      setWiggle(null);
    },
    onPointerCancel: () => {
      const lp = lpRef.current;
      if (lp && lp.timer) window.clearTimeout(lp.timer);
      lpRef.current = null;
      setWiggle(null);
    },
  }), [cellFromClient]);

  const handleTileClick = useCallback((e: React.MouseEvent<HTMLDivElement>, fallbackId: string) => {
    if (draggedRef.current) return;
    // Always resolve the id from the real click target so layered halos can't
    // misroute the click to an adjacent tile.
    const wrap = (e.target as HTMLElement).closest('[data-tile-id]') as HTMLElement | null;
    const id = wrap?.dataset.tileId ?? fallbackId;
    const s = useAppStore.getState();
    const t = s.tiles[id];
    if (!t) return;

    // Paint mode is handled at the pointer level (swipe paint), not via click.
    if (s.paintTool) return;

    // Double-tap detection: second tap on same tile within 300ms toggles bass
    // (note tiles only). The first tap of the pair has already fired its
    // single-tap actions, which is fine — they're idempotent.
    const now = performance.now();
    const last = lastTapRef.current;
    if (last && last.id === id && now - last.t < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      if (t.kind === 'note') s.toggleBass(id);
      else if (t.kind === 'repeat') s.cycleRepeatCount(id);
      return;
    }
    lastTapRef.current = { id, t: now };

    // Single-tap actions: preview pitch, select, halo if endpoint.
    if (t.kind === 'note') s.previewNote(t.pitch, t.bass);
    s.selectTile(id);
    // Single-tap on any repeat tile cycles the count (1×, 2×, 3×, 4×, ∞).
    if (t.kind === 'repeat') {
      s.cycleRepeatCount(id);
      return;
    }
    // Tapping a note tile fires play if either:
    //   (a) it's a strand endpoint (1 neighbour); or
    //   (b) it's adjacent to a repeat tile that's part of a positional pair —
    //       i.e. it sits at one end of a looping section. In that case the
    //       play target becomes the section's OPEN repeat so the loop pairs
    //       correctly inside a single segment.
    if (t.kind === 'note') {
      let target: string | null = null;
      if (isEndpoint(id, s.tiles, s.byCell)) {
        target = id;
      } else {
        const c = t.cell;
        if (c) {
          const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
          const pairs = findPositionalRepeatPairs(s.tiles, s.byCell);
          for (const d of dirs) {
            const nbrId = s.byCell[`${c.x + d.x},${c.y + d.y}`];
            if (!nbrId) continue;
            if (s.tiles[nbrId]?.kind !== 'repeat') continue;
            const pair = pairs.find(p => p.openId === nbrId || p.closeId === nbrId);
            if (pair) { target = pair.openId; break; }
          }
        }
      }
      if (target) {
        s.setStartTile(target);
        if (!s.isPlaying) s.play();
      }
    }
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

  // ------------------------------------------------------------------
  // Swipe-paint: when paintTool is active, capture pointer events at
  // window level so the user can drag across multiple tiles. Each tile
  // the pointer enters is added (chord/arp) or removed (eraser).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!paintTool) return;

    let active = false;
    let touchedThisStroke = new Set<TileId>();

    const tileFromPoint = (cx: number, cy: number): TileId | null => {
      const el = document.elementFromPoint(cx, cy);
      if (!el) return null;
      const wrap = (el as HTMLElement).closest('[data-tile-id]') as HTMLElement | null;
      return wrap?.dataset.tileId ?? null;
    };

    const visit = (id: TileId) => {
      if (touchedThisStroke.has(id)) return;
      touchedThisStroke.add(id);
      const s = useAppStore.getState();
      const t = s.tiles[id];
      if (!t || t.kind !== 'note') return;
      if (s.paintTool === 'eraser') {
        s.removeTileFromAllPaints(id);
        return;
      }
      // Toggle membership: tapping a tile already in the in-progress paint
      // removes it; otherwise adds it. Preview pitch so the user hears coverage.
      s.togglePaintMembership(id);
      s.previewNote(t.pitch, t.bass);
    };

    const onDown = (e: PointerEvent) => {
      const id = tileFromPoint(e.clientX, e.clientY);
      if (!id) return;
      // Prevent the canvas-pan handler from also firing for this stroke.
      e.preventDefault();
      e.stopPropagation();
      active = true;
      touchedThisStroke = new Set();
      visit(id);
    };
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const id = tileFromPoint(e.clientX, e.clientY);
      if (id) visit(id);
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      // Auto-commit chord/arp paints on release (eraser doesn't commit).
      const s = useAppStore.getState();
      if (s.paintTool !== 'eraser' && s.paintingTileIds.length >= 2) {
        s.commitPaint();
      } else if (s.paintTool !== 'eraser') {
        // <2 tiles: just clear the in-progress selection.
        useAppStore.setState({ paintingTileIds: [] });
      }
    };

    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onUp, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true } as any);
      window.removeEventListener('pointermove', onMove, { capture: true } as any);
      window.removeEventListener('pointerup', onUp, { capture: true } as any);
      window.removeEventListener('pointercancel', onUp, { capture: true } as any);
    };
  }, [paintTool]);

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
          const isStartEligible = t.kind === 'note' && (
            isEndpoint(t.id, tiles, byCell) ||
            // Section-end notes: adjacent to a repeat that's part of a paired
            // section, even if the note has 2 neighbours overall.
            (t.cell != null && [
              [1, 0], [-1, 0], [0, 1], [0, -1],
            ].some(([dx, dy]) => {
              const nbr = byCell[`${t.cell!.x + dx},${t.cell!.y + dy}`];
              return !!nbr && tiles[nbr]?.kind === 'repeat' &&
                positionalPairs.some(p => p.openId === nbr || p.closeId === nbr);
            }))
          );
          const isWiggling = wiggle?.id === t.id;
          const isInScope = highlightedSegment.has(t.id);
          const tilePaints = tilePaintKinds.get(t.id);
          const inProgress = paintingSet.has(t.id);
          const inRepeatSection = repeatSectionTiles.has(t.id);
          const isActive = !!activeTiles[t.id];
          const hasChord = tilePaints?.has('chord');
          const hasArp = tilePaints?.has('arp');
          const paintBorderColor = hasChord && hasArp ? PAINT_BOTH : hasChord ? PAINT_CHORD : hasArp ? PAINT_ARP : null;
          return (
            <div
              key={t.id}
              data-tile-id={t.id}
              className={`canvas-tile-wrapper absolute ${isWiggling ? 'songtile-wiggle' : ''}`}
              style={{ left: cell.x * CELL + 1, top: cell.y * CELL + 1, opacity: isWiggling ? 0.35 : 1 }}
              onClick={(e) => handleTileClick(e, t.id)}
              {...(paintTool ? {} : attachLongPressDragOff(t.id))}
            >
              {isInScope && !paintTool && (
                <div
                  className="segment-scope-ring absolute pointer-events-none"
                  style={{
                    inset: -3,
                    borderRadius: 17,
                    boxShadow: `0 0 0 2px ${tokens.tilePlayhead}`,
                    opacity: 0.55,
                  }}
                />
              )}
              {inProgress && (
                <div
                  className="paint-in-progress-ring absolute pointer-events-none"
                  style={{
                    inset: -5,
                    borderRadius: 19,
                    boxShadow: `0 0 0 3px ${tokens.tilePlayhead}`,
                    opacity: 0.9,
                  }}
                />
              )}
              {paintBorderColor && (
                <div
                  className="paint-border absolute pointer-events-none"
                  style={{
                    inset: -2,
                    borderRadius: 16,
                    boxShadow: `0 0 0 3px ${paintBorderColor}`,
                  }}
                />
              )}
              {inRepeatSection && (
                <div
                  className="repeat-section-ring absolute pointer-events-none"
                  style={{
                    inset: -4,
                    borderRadius: 18,
                    boxShadow: '0 0 0 3px #facc15',
                    opacity: 0.9,
                  }}
                />
              )}
              {isActive && (
                <div
                  className="active-tile-glow absolute pointer-events-none"
                  style={{
                    inset: -8,
                    borderRadius: 20,
                    boxShadow: `0 0 0 4px ${PAINT_GREEN}, 0 0 16px ${PAINT_GREEN}`,
                  }}
                />
              )}
              {isStartEligible && (
                <div
                  className={isStart ? 'start-halo absolute pointer-events-none' : 'endpoint-halo absolute pointer-events-none'}
                  style={{
                    inset: -6,
                    borderRadius: 18,
                    boxShadow: `0 0 0 3px ${isStart && isPlaying ? PAINT_GREEN : tokens.tilePlayhead}`,
                    opacity: isStart ? 1 : 0.45,
                  }}
                />
              )}
              <Tile
                tile={t}
                size={CELL - 2}
                orientation={t.kind === 'repeat' ? repeatOrientation(t.id) : 'h'}
                repeatSide={t.kind === 'repeat' ? (repeatSideById.get(t.id) ?? 'open') : 'open'}
              />
            </div>
          );
        })}
      </div>

      {wiggle && tiles[wiggle.id] && createPortal(
        <div
          className="wiggle-ghost fixed pointer-events-none z-50 songtile-wiggle"
          style={{ left: wiggle.x - CELL / 2, top: wiggle.y - CELL / 2 }}
        >
          <Tile tile={tiles[wiggle.id]} size={CELL} />
        </div>,
        document.body,
      )}
    </div>
  );
}
