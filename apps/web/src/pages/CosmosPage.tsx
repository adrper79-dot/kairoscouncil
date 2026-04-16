/**
 * @module @kairos/web/pages/CosmosPage
 * Displays current planetary positions and active transit events.
 * AC-002: All data comes from /cosmos API. No local calculations.
 */
import React from 'react';
import { useCosmosState } from '../stores/cosmosStore.js';
import { PlanetCard } from '../components/PlanetCard.js';

/** Full-page cosmos view showing live planetary state. */
export function CosmosPage(): React.ReactElement {
  const { state, loading, error } = useCosmosState();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#c4a8e0' }}>
        Consulting the heavens…
      </div>
    );
  }

  if (error ?? !state) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#c06060' }}>
        {error ?? 'Could not load cosmos state'}
      </div>
    );
  }

  const timestamp = new Date(state.timestamp);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.4rem' }}>The Cosmos</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        As of {timestamp.toUTCString()}
        {state.eclipseActive && (
          <span style={{ color: '#f0c040', marginLeft: '1rem' }}>
            ◉ Eclipse Active{state.eclipseType ? ` (${state.eclipseType})` : ''}
          </span>
        )}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#c4a8e0', marginBottom: '0.75rem' }}>Planetary Positions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {state.planetaryPositions.map((pos) => (
            <PlanetCard key={pos.planet} position={pos} />
          ))}
        </div>
      </section>

      {state.activeTransits.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#c4a8e0', marginBottom: '0.75rem' }}>
            Active Transits ({state.activeTransits.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {state.activeTransits.map((t, i) => (
              <div key={i} style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}>
                <strong>{t.transitingPlanet}</strong> → <strong>{t.natalPlanet}</strong>
                {' '}<span style={{ color: '#c4a8e0' }}>{t.aspectType}</span>
                {' '}<span style={{ color: '#888' }}>{t.orb.toFixed(2)}° orb</span>
                {t.exactnessScore >= 9 && <span style={{ color: '#f0c040', marginLeft: '0.5rem' }}>✦ Exact</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {state.activeAspects.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', color: '#c4a8e0', marginBottom: '0.75rem' }}>
            Active Aspects ({state.activeAspects.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {state.activeAspects.map((a, i) => (
              <div key={i} style={{ background: '#1a0f35', border: '1px solid #3d2b6e', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                {a.planet1} {a.type} {a.planet2} ({a.currentOrb.toFixed(1)}°)
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
