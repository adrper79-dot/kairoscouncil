/**
 * @module @kairos/web/pages/MatchPage
 * Match creation and state display.
 * AC-002: All match state comes from the server. Client is display only.
 */
import React, { useState } from 'react';
import { useApi, apiFetch } from '../hooks/useApi.js';
import type { Deck, MatchState } from '@kairos/shared';
import { LoginForm } from '../components/LoginForm.js';
import { useAuthStore } from '../stores/authStore.js';
import { clearAuth } from '../stores/authStore.js';

/** Match page — shows decks, allows starting a match, displays match state. */
export function MatchPage(): React.ReactElement {
  const { token } = useAuthStore();
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: decks, loading: decksLoading } = useApi<Deck[]>('/decks');

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#c4a8e0' }}>
          Sign in to access match play
        </p>
        <LoginForm />
      </div>
    );
  }

  async function startMatch(deckId: string): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      const result = await apiFetch<{ matchId: string; state: MatchState }>('/matches', {
        method: 'POST',
        body: JSON.stringify({ deckId, mode: 'transit' }),
      });
      setMatchState(result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match');
    } finally {
      setCreating(false);
    }
  }

  if (matchState) {
    const currentPlayer = matchState.players[0];
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.3rem' }}>Match in Progress</h1>
          <button onClick={() => setMatchState(null)} style={{ background: 'transparent', border: '1px solid #6b3fa0', color: '#c4a8e0', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
            ← Back
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Transit Clock</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f0c040' }}>
              {matchState.transitClocks[currentPlayer?.playerId ?? ""] ?? 0} / {matchState.mode === 'eclipse' ? 12 : 13}
            </div>
          </div>
          <div style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Celestial Energy</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7ec8a0' }}>
              {currentPlayer?.celestialEnergy ?? 0}
            </div>
          </div>
          <div style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Hand</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c4a8e0' }}>
              {currentPlayer?.hand.length ?? 0} cards
            </div>
          </div>
          <div style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Turn</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e8d5a3' }}>
              {matchState.turn}
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1rem', color: '#c4a8e0', marginBottom: '0.5rem' }}>Hand</h2>
          {(currentPlayer?.hand.length ?? 0) === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>No cards in hand</p>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {currentPlayer?.hand.map((cardId, i) => (
                <div key={i} style={{ background: '#1a0f35', border: '1px solid #6b3fa0', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#c4a8e0' }}>
                  {cardId}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.3rem' }}>Match</h1>
        <button onClick={clearAuth} style={{ background: 'transparent', border: '1px solid #c06060', color: '#c06060', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.85rem' }}>
          Sign out
        </button>
      </div>

      {error && <div style={{ color: '#c06060', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

      <h2 style={{ fontSize: '1rem', color: '#c4a8e0', marginBottom: '0.75rem' }}>Your Decks</h2>
      {decksLoading ? (
        <p style={{ color: '#888' }}>Loading decks…</p>
      ) : !decks?.length ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>No decks yet. Create one to start playing.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {decks.map((deck) => (
            <div key={deck.id} style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{deck.name}</div>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>{deck.archetypeSchool} · {deck.cardIds.length} cards</div>
              </div>
              <button
                disabled={creating}
                onClick={() => { void startMatch(deck.id); }}
                style={{ background: '#6b3fa0', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Starting…' : 'Play'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
