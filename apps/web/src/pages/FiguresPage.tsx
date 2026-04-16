/**
 * @module @kairos/web/pages/FiguresPage
 * Displays the Phase 0 roster of historical figures.
 * AC-002: Data comes from /figures API.
 */
import React from 'react';
import { useApi } from '../hooks/useApi.js';
import type { HistoricalFigure } from '@kairos/shared';

const FORGE_COLORS: Record<string, string> = {
  Chronos: '#7ec8e0',
  Eros: '#e07ea8',
  Aether: '#c4a8e0',
  Lux: '#f0c040',
  Phoenix: '#e07840',
};

/** Page listing all playable historical figures. */
export function FiguresPage(): React.ReactElement {
  const { data, loading, error } = useApi<HistoricalFigure[]>('/figures');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#c4a8e0' }}>Loading figures…</div>;
  }

  if (error ?? !data) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#c06060' }}>{error ?? 'Failed to load figures'}</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Council Figures</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {data.map((fig) => {
          const forgeColor = FORGE_COLORS[fig.primaryForge] ?? '#888';
          return (
            <div key={fig.id} style={{
              background: '#1a0f35',
              border: `1px solid ${forgeColor}`,
              borderRadius: '10px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{fig.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>{fig.era}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <span style={{ background: '#2a1a45', border: '1px solid #3d2b6e', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#c4a8e0' }}>
                  {fig.archetypeSchool}
                </span>
                <span style={{ background: '#2a1a45', border: `1px solid ${forgeColor}`, borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: forgeColor }}>
                  {fig.primaryForge} Forge
                </span>
              </div>
              {fig.personalLore && (
                <div style={{ fontSize: '0.8rem', color: '#9a8080', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  {fig.personalLore}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
