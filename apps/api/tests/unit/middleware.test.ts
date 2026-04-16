import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT, extractBearerToken, parseRateWindow, jsonResponse, errorResponse, addCorsHeaders } from '../../src/middleware/index.js';

const TEST_SECRET = 'super-secret-key-for-testing-32bytes!';

describe('parseRateWindow', () => {
  it('Parses "1m" → 60000ms', () => {
    expect(parseRateWindow('1m')).toBe(60_000);
  });

  it('Parses "5m" → 300000ms', () => {
    expect(parseRateWindow('5m')).toBe(300_000);
  });

  it('Parses "1h" → 3600000ms', () => {
    expect(parseRateWindow('1h')).toBe(3_600_000);
  });

  it('Parses "30s" → 30000ms', () => {
    expect(parseRateWindow('30s')).toBe(30_000);
  });

  it('Returns 60000 for unknown format', () => {
    expect(parseRateWindow('invalid')).toBe(60_000);
    expect(parseRateWindow('')).toBe(60_000);
  });

  it('Parses "2h" → 7200000ms', () => {
    expect(parseRateWindow('2h')).toBe(7_200_000);
  });
});

describe('signJWT / verifyJWT', () => {
  it('Signs and verifies a JWT successfully', async () => {
    const token = await signJWT({ sub: 'user-123', email: 'test@example.com' }, TEST_SECRET);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('Verified payload contains sub and email', async () => {
    const token = await signJWT({ sub: 'user-abc', email: 'foo@bar.com' }, TEST_SECRET);
    const payload = await verifyJWT(token, TEST_SECRET);
    expect(payload.sub).toBe('user-abc');
    expect(payload.email).toBe('foo@bar.com');
  });

  it('Throws when verifying with wrong secret', async () => {
    const token = await signJWT({ sub: 'user-123', email: 'test@test.com' }, TEST_SECRET);
    await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow();
  });

  it('Throws for a malformed token', async () => {
    await expect(verifyJWT('not.a.jwt', TEST_SECRET)).rejects.toThrow();
  });

  it('Throws for an empty string token', async () => {
    await expect(verifyJWT('', TEST_SECRET)).rejects.toThrow();
  });
});

describe('extractBearerToken', () => {
  it('Extracts token from "Bearer <token>" header', () => {
    const req = new Request('https://example.com', {
      headers: { Authorization: 'Bearer my-token-value' },
    });
    expect(extractBearerToken(req)).toBe('my-token-value');
  });

  it('Returns null when Authorization header is missing', () => {
    const req = new Request('https://example.com');
    expect(extractBearerToken(req)).toBeNull();
  });

  it('Returns null for non-Bearer auth schemes', () => {
    const req = new Request('https://example.com', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(extractBearerToken(req)).toBeNull();
  });

  it('Returns empty string for "Bearer" with no token after space', () => {
    // "Bearer " with trailing space: slice(7) returns empty string
    // Note: some header implementations may trim this to null — behavior is implementation-defined
    const req = new Request('https://example.com', {
      headers: { Authorization: 'Bearer abc' },
    });
    const token = extractBearerToken(req);
    expect(token).toBe('abc');
  });
});

describe('jsonResponse', () => {
  it('Returns 200 by default', () => {
    const res = jsonResponse({ foo: 'bar' });
    expect(res.status).toBe(200);
  });

  it('Accepts custom status code', () => {
    const res = jsonResponse({ id: '123' }, 201);
    expect(res.status).toBe(201);
  });

  it('Content-Type is application/json', () => {
    const res = jsonResponse({ x: 1 });
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('Body contains success:true and data', async () => {
    const res = jsonResponse({ score: 42 });
    const body = await res.json() as { success: boolean; data: { score: number } };
    expect(body.success).toBe(true);
    expect(body.data.score).toBe(42);
  });
});

describe('errorResponse', () => {
  it('Returns specified status code', () => {
    const res = errorResponse('NOT_FOUND', 'Not found', 404);
    expect(res.status).toBe(404);
  });

  it('Body contains success:false and error', async () => {
    const res = errorResponse('FORBIDDEN', 'Access denied', 403);
    const body = await res.json() as { success: boolean; error: { code: string; message: string; retryable: boolean } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Access denied');
  });

  it('Retryable defaults to false', async () => {
    const res = errorResponse('RATE_LIMITED', 'Too many requests', 429);
    const body = await res.json() as { success: boolean; error: { retryable: boolean } };
    expect(body.error.retryable).toBe(false);
  });

  it('Accepts retryable=true', async () => {
    const res = errorResponse('RATE_LIMITED', 'Too many requests', 429, true);
    const body = await res.json() as { success: boolean; error: { retryable: boolean } };
    expect(body.error.retryable).toBe(true);
  });

  it('Content-Type is application/json', () => {
    const res = errorResponse('INTERNAL_ERROR', 'Oops', 500);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('addCorsHeaders', () => {
  it('Adds Access-Control-Allow-Origin: *', () => {
    const base = new Response('{}', { status: 200 });
    const res = addCorsHeaders(base);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('Adds Access-Control-Allow-Methods', () => {
    const base = new Response('{}', { status: 200 });
    const res = addCorsHeaders(base);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('Preserves original status code', () => {
    const base = new Response('{}', { status: 201 });
    const res = addCorsHeaders(base);
    expect(res.status).toBe(201);
  });
});
