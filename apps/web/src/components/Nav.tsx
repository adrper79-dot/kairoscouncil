/**
 * @module @kairos/web/components/Nav
 * Top navigation bar — mobile-first.
 */
import React from 'react';

type Route = 'cosmos' | 'match' | 'figures';

interface NavProps {
  route: Route;
  onNavigate: (r: Route) => void;
  authenticated: boolean;
}

const NAV_STYLE: React.CSSProperties = {
  background: '#1a0f35',
  borderBottom: '1px solid #3d2b6e',
  padding: '0.75rem 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
};

const BTN_STYLE = (active: boolean): React.CSSProperties => ({
  background: active ? '#6b3fa0' : 'transparent',
  color: active ? '#fff' : '#c4a8e0',
  border: '1px solid #6b3fa0',
  borderRadius: '6px',
  padding: '0.4rem 0.9rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontFamily: 'Georgia, serif',
});

/** Navigation bar with route links. */
export function Nav({ route, onNavigate, authenticated }: NavProps): React.ReactElement {
  return (
    <nav style={NAV_STYLE}>
      <span style={{ marginRight: 'auto', fontWeight: 'bold', fontSize: '1.1rem', color: '#e8d5a3' }}>
        ✦ Kairos&apos; Council
      </span>
      <button style={BTN_STYLE(route === 'cosmos')} onClick={() => onNavigate('cosmos')}>
        Cosmos
      </button>
      <button style={BTN_STYLE(route === 'figures')} onClick={() => onNavigate('figures')}>
        Figures
      </button>
      {authenticated && (
        <button style={BTN_STYLE(route === 'match')} onClick={() => onNavigate('match')}>
          Match
        </button>
      )}
    </nav>
  );
}
