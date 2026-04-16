/**
 * @module @kairos/web/App
 * Root application component with simple client-side routing.
 * AC-002: Display layer only — no game calculations performed here.
 */
import React, { useState } from 'react';
import { CosmosPage } from './pages/CosmosPage.js';
import { MatchPage } from './pages/MatchPage.js';
import { FiguresPage } from './pages/FiguresPage.js';
import { Nav } from './components/Nav.js';
import { useAuthStore } from './stores/authStore.js';

type Route = 'cosmos' | 'match' | 'figures';

/** Root application. Handles top-level routing and auth state. */
export function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>('cosmos');
  const { token } = useAuthStore();

  function renderPage(): React.ReactElement {
    switch (route) {
      case 'match': return <MatchPage />;
      case 'figures': return <FiguresPage />;
      default: return <CosmosPage />;
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0f0a1e', color: '#e8d5a3' }}>
      <Nav route={route} onNavigate={setRoute} authenticated={token !== null} />
      <main style={{ flex: 1, padding: '1rem' }}>
        {renderPage()}
      </main>
    </div>
  );
}
