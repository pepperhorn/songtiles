import { create } from 'zustand';
import type { Cell, TileId, TrayCapacity, RepeatPoolSize, Tile } from '../graph/types';
import type { DeckRecord } from './deck';
import { createDeck, drawTo, returnToDeck, discardFromTray } from './deck';
import { newTileId } from '../utils/id';
import type { RepeatOpenTile, RepeatCloseTile } from '../graph/types';

// ---------------------------------------------------------------------------
// Repeat-tile pool helpers
// ---------------------------------------------------------------------------

function buildRepeatPool(size: RepeatPoolSize): Map<TileId, RepeatOpenTile | RepeatCloseTile> {
  const pool = new Map<TileId, RepeatOpenTile | RepeatCloseTile>();
  for (let i = 0; i < size; i++) {
    const openId = newTileId();
    const closeId = newTileId();
    const open: RepeatOpenTile = { id: openId, kind: 'repeat-open', count: 2, cell: null };
    const close: RepeatCloseTile = { id: closeId, kind: 'repeat-close', cell: null };
    pool.set(openId, open);
    pool.set(closeId, close);
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

export interface CanvasState {
  /** cell key → tile id placed there */
  cellMap: Map<string, TileId>;
  /** tile id → Cell for placed tiles */
  placedTiles: Map<TileId, Cell>;
  /** the tile id that is "start" (halo) */
  startTileId: TileId | null;
}

// ---------------------------------------------------------------------------
// AppState
// ---------------------------------------------------------------------------

export interface AppState {
  // Session config
  trayCapacity: TrayCapacity;
  repeatPoolSize: RepeatPoolSize;

  // Deck + tray
  deck: DeckRecord;

  // Repeat tile pool
  repeatPool: Map<TileId, RepeatOpenTile | RepeatCloseTile>;
  /** How many full repeat-set pairs remain available */
  repeatSetsRemaining: number;

  // Canvas
  canvas: CanvasState;

  // All tiles (note tiles live in deck.registry; repeat tiles live in repeatPool)
  // Helper accessor
  getTile: (id: TileId) => Tile | undefined;

  // Actions
  initSession: (opts: { trayCapacity: TrayCapacity; repeatPoolSize: RepeatPoolSize }) => void;
  refillTray: () => void;
  discardTrayTile: (id: TileId) => void;
  placeTileOnCell: (id: TileId, cell: Cell) => void;
  returnTileFromCanvas: (id: TileId) => void;
  setStartTile: (id: TileId) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

import { cellKey } from '../graph/types';

export const useAppStore = create<AppState>((set, get) => ({
  trayCapacity: 6,
  repeatPoolSize: 5,
  deck: createDeck(),
  repeatPool: new Map(),
  repeatSetsRemaining: 0,
  canvas: {
    cellMap: new Map(),
    placedTiles: new Map(),
    startTileId: null,
  },

  getTile(id: TileId): Tile | undefined {
    const state = get();
    return state.deck.registry.get(id) ?? state.repeatPool.get(id);
  },

  // -------------------------------------------------------------------------
  initSession({ trayCapacity, repeatPoolSize }) {
    const freshDeck = createDeck();
    const filled = drawTo(freshDeck, trayCapacity);
    const repeatPool = buildRepeatPool(repeatPoolSize);

    set({
      trayCapacity,
      repeatPoolSize,
      deck: filled,
      repeatPool,
      repeatSetsRemaining: repeatPoolSize,
      canvas: {
        cellMap: new Map(),
        placedTiles: new Map(),
        startTileId: null,
      },
    });
  },

  // -------------------------------------------------------------------------
  refillTray() {
    set(state => ({
      deck: drawTo(state.deck, state.trayCapacity),
    }));
  },

  // -------------------------------------------------------------------------
  discardTrayTile(id: TileId) {
    set(state => ({
      deck: discardFromTray(state.deck, id),
    }));
  },

  // -------------------------------------------------------------------------
  placeTileOnCell(id: TileId, cell: Cell) {
    set(state => {
      const key = cellKey(cell);
      const newCellMap = new Map(state.canvas.cellMap);
      const newPlacedTiles = new Map(state.canvas.placedTiles);

      // If something was already at this cell, remove it
      const existingId = newCellMap.get(key);
      if (existingId) {
        newPlacedTiles.delete(existingId);
      }

      newCellMap.set(key, id);
      newPlacedTiles.set(id, cell);

      // Remove from tray
      const newTray = state.deck.tray.filter(t => t !== id);
      const newDeck = { ...state.deck, tray: newTray };

      // Auto-halo: if this is the first tile placed, make it the start tile
      const isFirstPlaced = newPlacedTiles.size === 1;
      const startTileId = isFirstPlaced ? id : state.canvas.startTileId;

      return {
        deck: newDeck,
        canvas: {
          ...state.canvas,
          cellMap: newCellMap,
          placedTiles: newPlacedTiles,
          startTileId,
        },
      };
    });
  },

  // -------------------------------------------------------------------------
  returnTileFromCanvas(id: TileId) {
    set(state => {
      const cell = state.canvas.placedTiles.get(id);
      if (!cell) return state; // tile not on canvas

      const newCellMap = new Map(state.canvas.cellMap);
      const newPlacedTiles = new Map(state.canvas.placedTiles);
      newCellMap.delete(cellKey(cell));
      newPlacedTiles.delete(id);

      // Clear halo if this tile was the start tile
      const startTileId = state.canvas.startTileId === id ? null : state.canvas.startTileId;

      // Return tile to bottom of deck
      const newDeck = returnToDeck(state.deck, id);

      return {
        deck: newDeck,
        canvas: {
          ...state.canvas,
          cellMap: newCellMap,
          placedTiles: newPlacedTiles,
          startTileId,
        },
      };
    });
  },

  // -------------------------------------------------------------------------
  setStartTile(id: TileId) {
    set(state => ({
      canvas: { ...state.canvas, startTileId: id },
    }));
  },
}));
