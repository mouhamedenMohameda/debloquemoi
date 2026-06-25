/**
 * Pont entre l'écran Historique et l'écran Home pour recharger une session.
 * Même pattern que `exerciseStore.ts`.
 */

import type { SavedSession } from "./history";

let pending: SavedSession | null = null;

export function setPendingSession(s: SavedSession): void {
  pending = s;
}

export function takePendingSession(): SavedSession | null {
  const p = pending;
  pending = null;
  return p;
}
