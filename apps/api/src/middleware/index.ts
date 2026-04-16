/**
 * @module @kairos/api/middleware
 * Auth, rate limiting, CORS, and response helpers.
 */

import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, RateLimitConfig, ApiResponse, ApiErrorResponse } from '@kairos/shared';

/** Sign a JWT with HS256, 24h expiry. */
export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key);
}

/** Verify a JWT and return its payload. Throws on invalid/expired token. */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as JWTPayload;
}

/** Extract Bearer token from Authorization header. */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/** Authenticate a request; throws with HTTP 401 on failure. */
export async function authenticateRequest(request: Request, secret: string): Promise<JWTPayload> {
  const token = extractBearerToken(request);
  if (!token) throw Object.assign(new Error('Missing token'), { status: 401, code: 'UNAUTHORIZED' });
  try {
    return await verifyJWT(token, secret);
  } catch {
    throw Object.assign(new Error('Invalid token'), { status: 401, code: 'UNAUTHORIZED' });
  }
}

/** Parse a rate-limit window string like "1m" or "5m" to milliseconds. */
export function parseRateWindow(window: string): number {
  const match = /^(\d+)([smh])$/.exec(window);
  if (!match) return 60_000;
  const n = parseInt(match[1] ?? '1', 10);
  const unit = match[2];
  if (unit === 's') return n * 1_000;
  if (unit === 'h') return n * 3_600_000;
  return n * 60_000; // 'm'
}

/** Check KV-backed rate limit. Returns allowed flag and remaining count. */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowMs = parseRateWindow(config.window);
  const bucket = Math.floor(Date.now() / windowMs);
  const kvKey = `ratelimit:${key}:${bucket}`;
  const raw = await kv.get(kvKey);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= config.requests) return { allowed: false, remaining: 0 };
  await kv.put(kvKey, String(count + 1), { expirationTtl: Math.ceil(windowMs / 1000) + 10 });
  return { allowed: true, remaining: config.requests - count - 1 };
}

/** Build a standard JSON Response. */
export function jsonResponse<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build a standard JSON error Response. */
export function errorResponse(code: string, message: string, status: number, retryable = false): Response {
  const error: ApiErrorResponse = { code, message, retryable };
  const body: ApiResponse<never> = { success: false, error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Add permissive CORS headers to a Response. */
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

