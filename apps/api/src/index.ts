/**
 * @module @kairos/api
 * Cloudflare Workers API entry point.
 * AC-002: All game state is authoritative server-side.
 */

import { handleRequest } from './routes/index.js';
import { addCorsHeaders } from './middleware/index.js';

export { MatchDurableObject } from './durable-objects/index.js';

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }));
    }
    const response = await handleRequest(request, _env);
    return addCorsHeaders(response);
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
