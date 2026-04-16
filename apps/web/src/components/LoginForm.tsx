/**
 * @module @kairos/web/components/LoginForm
 * Login / register form.
 * AC-002: All auth is server-side. This only collects and submits credentials.
 */
import React, { useState } from 'react';
import { setAuth } from '../stores/authStore.js';

interface LoginFormProps {
  onSuccess?: () => void;
}

interface AuthApiResponse {
  player: { id: string; email: string };
  token: string;
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  background: '#1a0f35',
  border: '1px solid #6b3fa0',
  borderRadius: '6px',
  color: '#e8d5a3',
  fontSize: '1rem',
  fontFamily: 'Georgia, serif',
};

const BTN_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem',
  background: '#6b3fa0',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1rem',
  fontFamily: 'Georgia, serif',
  cursor: 'pointer',
};

/** Login/register form — switches between modes. */
export function LoginForm({ onSuccess }: LoginFormProps): React.ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { email } : { email, displayName };

    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; data?: AuthApiResponse; error?: { message: string } };
      if (!res.ok || !data.data) {
        setError(data.error?.message ?? 'Authentication failed');
      } else {
        setAuth(data.data.token, data.data.player.id, data.data.player.email);
        onSuccess?.();
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} style={{ maxWidth: '360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        {mode === 'login' ? 'Enter the Council' : 'Join the Council'}
      </h2>

      {error && <div style={{ color: '#c06060', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

      <input style={INPUT_STYLE} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      {mode === 'register' && (
        <input style={INPUT_STYLE} type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      )}

      <button style={BTN_STYLE} type="submit" disabled={loading}>
        {loading ? 'Loading…' : mode === 'login' ? 'Login' : 'Register'}
      </button>

      <button type="button" style={{ ...BTN_STYLE, background: 'transparent', border: '1px solid #6b3fa0', color: '#c4a8e0' }}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Create account' : 'Already have an account'}
      </button>
    </form>
  );
}
