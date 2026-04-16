/**
 * @module @kairos/api
 * Cloudflare Workers API entry point.
 * AC-002: All game state is authoritative server-side.
 */

export default {
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '0.0.1' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Routes to be implemented in Task 12
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

/** Cloudflare Worker environment bindings. */
export interface Env {
  ENVIRONMENT: string;
  NEON_DATABASE_URL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  MATCH_DO: DurableObjectNamespace;
  TRANSIT_CACHE: KVNamespace;
}
