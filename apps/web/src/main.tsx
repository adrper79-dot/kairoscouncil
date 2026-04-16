/**
 * @module @kairos/web/main
 * React app entry point. Display layer only — AC-002.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
