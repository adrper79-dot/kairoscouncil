/**
 * @module @kairos/web/stores/cosmosStore
 * Cosmos state store — fetches from /cosmos API endpoint.
 * AC-002: All astronomical calculations are server-side.
 */
import { useState, useEffect } from 'react';
import type { CosmosState } from '@kairos/shared';

const API_BASE = '/api';

interface CosmosStoreState {
  state: CosmosState | null;
  loading: boolean;
  error: string | null;
}

/** Fetch the current cosmos state from the API. */
export async function fetchCosmosState(): Promise<CosmosState> {
  const res = await fetch(`${API_BASE}/cosmos`);
  if (!res.ok) throw new Error(`Failed to fetch cosmos: ${res.status.toString()}`);
  const data = await res.json() as { success: boolean; data: CosmosState };
  return data.data;
}

/** React hook that fetches and auto-refreshes cosmos state every 10 minutes. */
export function useCosmosState(): CosmosStoreState {
  const [store, setStore] = useState<CosmosStoreState>({ state: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const state = await fetchCosmosState();
        if (!cancelled) setStore({ state, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setStore({ state: null, loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    void load();
    const interval = setInterval(() => { void load(); }, 10 * 60 * 1000);
    return (): void => { cancelled = true; clearInterval(interval); };
  }, []);

  return store;
}
