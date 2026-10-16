// Anonymous per-browser workspace id: Firestore keeps each visitor's activity separate
const WORKSPACE_KEY = 'mnemo_workspace_id';
let memoryId: string | null = null;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function getWorkspaceId(): string {
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    if (saved) return saved;
    const id = newId();
    localStorage.setItem(WORKSPACE_KEY, id);
    return id;
  } catch {
    memoryId = memoryId || newId();
    return memoryId;
  }
}

export type WorkspaceEventType =
  | 'decision_captured'
  | 'document_audited'
  | 'conflicts_scanned'
  | 'conflict_sent'
  | 'review_requested'
  | 'demo_reset';

// Saves an event to the workspace in Firestore. Never blocks or breaks the UI.
export async function logWorkspaceEvent(type: WorkspaceEventType, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(`/api/workspace/${getWorkspaceId()}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.saved);
  } catch {
    return false;
  }
}
