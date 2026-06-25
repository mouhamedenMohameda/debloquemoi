/**
 * Store global ultra-simple pour pré-remplir l'écran Home depuis l'écran
 * Banque d'exercices. Évite d'ajouter une lib de state management juste
 * pour ce cas.
 */

type Listener = () => void;

type Pending = {
  exercise: string;
  subjectId?: string;
  exerciseRefId?: string;
} | null;

let pending: Pending = null;
const listeners = new Set<Listener>();

export function setPending(p: Pending): void {
  pending = p;
  for (const l of listeners) l();
}

export function takePending(): Pending {
  const p = pending;
  pending = null;
  return p;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
