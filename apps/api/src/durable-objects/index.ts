/**
 * @module @kairos/api/durable-objects
 * Match Durable Object — real-time match state via WebSocket.
 * AC-002: Server-side authority for all match state.
 */

import type { Env } from '../index.js';

/** WebSocket-based real-time match coordinator. */
export class MatchDurableObject implements DurableObject {
  private readonly sessions: Map<string, WebSocket> = new Map();

  constructor(
    private readonly state: DurableObjectState,
    private readonly _env: Env,
  ) {}

  /** Handle incoming requests: upgrades GET /ws to WebSocket, rejects others. */
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 });
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') ?? 'unknown';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.state.acceptWebSocket(server);
    this.sessions.set(playerId, server);

    server.addEventListener('close', () => {
      this.sessions.delete(playerId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Broadcast a message to all connected sessions. */
  broadcast(data: unknown): void {
    const message = JSON.stringify(data);
    for (const ws of this.sessions.values()) {
      try { ws.send(message); } catch { /* ignore closed sockets */ }
    }
  }
}

