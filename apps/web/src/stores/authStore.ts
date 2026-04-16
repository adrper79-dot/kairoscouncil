/**
 * @module @kairos/web/stores/authStore
 * Simple auth state store (token + player ID).
 * AC-002: Only the server validates JWTs. This is display state only.
 */
import { useState, useEffect } from 'react';

interface AuthState {
  token: string | null;
  playerId: string | null;
  email: string | null;
}

/** Global auth state — module-level singleton for simplicity in Phase 0. */
let _state: AuthState = {
  token: localStorage.getItem('kairos_token'),
  playerId: localStorage.getItem('kairos_playerId'),
  email: localStorage.getItem('kairos_email'),
};
const _listeners = new Set<() => void>();

function notify(): void {
  for (const fn of _listeners) fn();
}

/** Get the current auth token. */
export function getToken(): string | null { return _state.token; }

/** Set auth state after login/register. */
export function setAuth(token: string, playerId: string, email: string): void {
  _state = { token, playerId, email };
  localStorage.setItem('kairos_token', token);
  localStorage.setItem('kairos_playerId', playerId);
  localStorage.setItem('kairos_email', email);
  notify();
}

/** Clear auth state on logout. */
export function clearAuth(): void {
  _state = { token: null, playerId: null, email: null };
  localStorage.removeItem('kairos_token');
  localStorage.removeItem('kairos_playerId');
  localStorage.removeItem('kairos_email');
  notify();
}

/** React hook to subscribe to auth state. Properly cleans up on unmount. */
export function useAuthStore(): AuthState {
  const [, rerender] = useState(0);

  useEffect(() => {
    const fn = (): void => { rerender((n) => n + 1); };
    _listeners.add(fn);
    return (): void => { _listeners.delete(fn); };
  }, []);

  return _state;
}
