/**
 * @module @kairos/web/hooks/useApi
 * Generic API fetch hook with loading/error state.
 * AC-002: All data comes from the server API.
 */
import { useState, useEffect } from 'react';
import { getToken } from '../stores/authStore.js';

const API_BASE = '/api';

interface ApiHookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Fetch data from an API endpoint with auth token if available. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await res.json() as { success: boolean; data: T; error?: { message: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status.toString()}`);
  return body.data;
}

/** React hook to load data from an API endpoint on mount. */
export function useApi<T>(path: string): ApiHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<T>(path)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });

    return (): void => { cancelled = true; };
  }, [path, tick]);

  return { data, loading, error, refetch: (): void => setTick((n) => n + 1) };
}
