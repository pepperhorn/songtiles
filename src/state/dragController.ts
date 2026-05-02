import type { Cell } from '../graph/types';

/**
 * Bridges Tray (drag source) and Canvas (drop target) for tile placement,
 * plus a reverse hit-test so the Canvas can ask "is this point over the tray?"
 * when the user drags an endpoint tile back off the canvas.
 */
type CellResolver = (clientX: number, clientY: number) => Cell | null;
type TrayHitTest = (clientX: number, clientY: number) => boolean;

let canvasResolver: CellResolver | null = null;
let trayHitTest: TrayHitTest | null = null;

export function setCanvasResolver(r: CellResolver | null): void {
  canvasResolver = r;
}
export function resolveCanvasCell(clientX: number, clientY: number): Cell | null {
  return canvasResolver ? canvasResolver(clientX, clientY) : null;
}

export function setTrayHitTest(t: TrayHitTest | null): void {
  trayHitTest = t;
}
export function isOverTray(clientX: number, clientY: number): boolean {
  return trayHitTest ? trayHitTest(clientX, clientY) : false;
}
