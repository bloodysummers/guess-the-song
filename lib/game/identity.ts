/**
 * Per-tab player identity, used to reconnect after a reload.
 *
 * Stored in sessionStorage (NOT localStorage) on purpose: sessionStorage is scoped
 * to a single tab, so opening several tabs on one machine simulates several distinct
 * players — and it still survives a reload, which is what reconnection needs.
 */

export interface StoredIdentity {
  sessionId: string;
  playerId: string;
  reconnectToken: string;
  isHost: boolean;
  displayName: string;
  code: string;
}

const KEY = "gts:identity";

export function saveIdentity(identity: StoredIdentity): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(identity));
}

export function loadIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
