import type { Cell } from '../graph/types';

/**
 * Bridge between Tray (drag source) and Canvas (drop target). The Canvas
 * registers a resolver that maps a screen point to the world cell under it
 * (or null if the point is outside the canvas). The Tray calls
 * `resolveCanvasCell` on pointer-up to decide whether to place the tile.
 */
type Resolver = (clientX: number, clientY: number) => Cell | null;

let resolver: Resolver | null = null;

export function setCanvasResolver(r: Resolver | null): void {
  resolver = r;
}

export function resolveCanvasCell(clientX: number, clientY: number): Cell | null {
  return resolver ? resolver(clientX, clientY) : null;
}
