/**
 * @module @kairos/web/components/PlanetCard
 * Displays a single planet's current position and dignity.
 * AC-002: Data comes from server; this is display only.
 */
import React from 'react';
import type { PlanetaryPosition } from '@kairos/shared';

const DIGNITY_COLORS: Record<string, string> = {
  domicile: '#7ec8a0',
  exaltation: '#f0c040',
  detriment: '#c06060',
  fall: '#a05050',
  peregrine: '#888',
};

const PLANET_GLYPHS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '⛢', Neptune: '♆', Pluto: '♇',
};

interface PlanetCardProps {
  position: PlanetaryPosition;
}

/** Compact planet card showing glyph, sign, degree, dignity, retrograde. */
export function PlanetCard({ position }: PlanetCardProps): React.ReactElement {
  const glyph = PLANET_GLYPHS[position.planet] ?? '●';
  const dignityColor = DIGNITY_COLORS[position.dignity] ?? '#888';

  return (
    <div style={{
      background: '#1a0f35',
      border: '1px solid #3d2b6e',
      borderRadius: '8px',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      minWidth: '120px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem' }}>{glyph}</span>
        <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{position.planet}</span>
        {position.isRetrograde && <span style={{ color: '#c06060', fontSize: '0.75rem' }}>℞</span>}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#c4a8e0' }}>
        {position.sign} {position.degree.toFixed(1)}°
      </div>
      <div style={{ fontSize: '0.75rem', color: dignityColor, textTransform: 'capitalize' }}>
        {position.dignity}
      </div>
    </div>
  );
}
