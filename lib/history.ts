/**
 * Historique local des sessions de travail.
 *
 * Inspiré de HomeClient.tsx (web) qui sauvegarde dans localStorage. Côté mobile,
 * AsyncStorage. Clé `debloquemoi_sessions_v1:{email}` (l'email tient lieu d'id
 * stable côté client, on n'a pas le user_id numérique exposé).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY_PREFIX = "debloquemoi_sessions_v1:";
const MAX_SESSIONS = 50;

export type SessionMode = "hint" | "explain";
export type SessionHintLevel = 1 | 2 | 3;

export type SessionHint = {
  level: SessionHintLevel;
  text: string;
  mode: SessionMode;
  free_hint_used?: boolean;
  balance_mru?: number;
  truncated?: boolean;
};

export type SavedSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  mode: SessionMode;
  subjectId: string;
  chapterId: string | null;
  exercise: string;
  correction?: string;
  focusQuestion: string;
  hints: SessionHint[];
};

function keyFor(userId: string): string {
  return `${HISTORY_KEY_PREFIX}${userId}`;
}

export function makeSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sessionTitle(s: SavedSession): string {
  const raw = (s.exercise || s.correction || "").trim();
  const cleaned = raw.replace(/\s+/g, " ").replace(/[#*`>]/g, "");
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned || "Nouvelle session";
}

export function relativeTime(t: number): string {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return "À l'instant";
  if (d < 3600) {
    const m = Math.floor(d / 60);
    return `il y a ${m} min`;
  }
  if (d < 86400) {
    const h = Math.floor(d / 3600);
    return `il y a ${h} h`;
  }
  if (d < 604800) {
    const j = Math.floor(d / 86400);
    return `il y a ${j} j`;
  }
  return new Date(t).toLocaleDateString("fr-FR");
}

export async function loadSessions(userId: string): Promise<SavedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isValidSession).slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

export async function saveSessions(
  userId: string,
  sessions: SavedSession[],
): Promise<void> {
  try {
    const capped = sessions.slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(capped));
  } catch {
    // silently ignore — storage plein, etc.
  }
}

export async function upsertSession(
  userId: string,
  session: SavedSession,
): Promise<SavedSession[]> {
  const prev = await loadSessions(userId);
  const idx = prev.findIndex((s) => s.id === session.id);
  let next: SavedSession[];
  if (idx >= 0) {
    next = [{ ...session, updatedAt: Date.now() }, ...prev.filter((_, i) => i !== idx)];
  } else {
    next = [{ ...session, updatedAt: Date.now() }, ...prev];
  }
  await saveSessions(userId, next);
  return next;
}

export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<SavedSession[]> {
  const prev = await loadSessions(userId);
  const next = prev.filter((s) => s.id !== sessionId);
  await saveSessions(userId, next);
  return next;
}

function isValidSession(s: unknown): s is SavedSession {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.exercise === "string" &&
    Array.isArray(o.hints)
  );
}
