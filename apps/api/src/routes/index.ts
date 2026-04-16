/**
 * @module @kairos/api/routes
 * API route handlers — all game state computed server-side (AC-002).
 */

import {
  createDb,
  getPlayerByEmail,
  createPlayer,
  getAllFigures,
  getFigureById,
  getDecksByOwner,
  getDeckById,
  createDeck,
  createMatch,
  getMatchById,
} from '@kairos/database';
import { computeCosmosStateFromDate, detectNamedEvents } from '@kairos/astronomical-engine';
import { initializeMatch, drawOpeningHand } from '@kairos/game-engine';
import type { MatchMode, CosmosSnapshot } from '@kairos/shared';
import { RATE_LIMITS } from '@kairos/shared';
import type { Env } from '../index.js';
import {
  authenticateRequest,
  jsonResponse,
  errorResponse,
  signJWT,
  checkRateLimit,
} from '../middleware/index.js';

/** Safely parse a JSON request body into a plain object. */
async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  // request.json() returns `any` from CF workers types; we validate shape here.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const raw = await request.json();
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Route a request to the appropriate handler. */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limit = await checkRateLimit(
    env.TRANSIT_CACHE,
    `api:${clientIp}`,
    RATE_LIMITS['api'] ?? { requests: 300, window: '1m' },
  );
  if (!limit.allowed) return errorResponse('RATE_LIMITED', 'Too many requests', 429, true);

  try {
    if (path === '/health') return handleHealth();
    if (path === '/cosmos' && method === 'GET') return handleCosmos();
    if (path === '/auth/register' && method === 'POST') return handleRegister(request, env);
    if (path === '/auth/login' && method === 'POST') return handleLogin(request, env);
    if (path === '/figures' && method === 'GET') return handleListFigures(env);
    if (path.startsWith('/figures/') && method === 'GET') return handleGetFigure(path, env);
    if (path === '/decks' && method === 'GET') return handleListDecks(request, env);
    if (path === '/decks' && method === 'POST') return handleCreateDeck(request, env);
    if (path.startsWith('/decks/') && method === 'GET') return handleGetDeck(path, request, env);
    if (path === '/matches' && method === 'POST') return handleCreateMatch(request, env);
    if (path.startsWith('/matches/') && method === 'GET') return handleGetMatch(path, request, env);
    return errorResponse('NOT_FOUND', 'Route not found', 404);
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    return errorResponse(e.code ?? 'INTERNAL_ERROR', e.message ?? 'Internal error', e.status ?? 500);
  }
}

/** GET /health */
function handleHealth(): Response {
  return jsonResponse({ status: 'ok', version: '0.0.1' });
}

/** GET /cosmos — current astronomical state (public, no auth) */
function handleCosmos(): Response {
  const state = computeCosmosStateFromDate(new Date());
  return jsonResponse(state);
}

/** POST /auth/register */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  const rl = await checkRateLimit(
    env.TRANSIT_CACHE,
    `auth:${request.headers.get('CF-Connecting-IP') ?? 'x'}`,
    RATE_LIMITS['auth'] ?? { requests: 10, window: '1m' },
  );
  if (!rl.allowed) return errorResponse('RATE_LIMITED', 'Too many auth attempts', 429, true);

  const body = await parseJsonBody(request);
  const email = body['email'];
  const displayName = body['displayName'];
  if (typeof email !== 'string' || typeof displayName !== 'string') {
    return errorResponse('VALIDATION_ERROR', 'email and displayName required', 400);
  }

  const sql = createDb(env.NEON_DATABASE_URL);
  const existing = await getPlayerByEmail(sql, email);
  if (existing) return errorResponse('CONFLICT', 'Email already registered', 409);

  const player = await createPlayer(sql, email, displayName);
  const token = await signJWT({ sub: player.id, email: player.email }, env.JWT_SECRET);
  return jsonResponse({ player, token }, 201);
}

/** POST /auth/login */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  const rl = await checkRateLimit(
    env.TRANSIT_CACHE,
    `auth:${request.headers.get('CF-Connecting-IP') ?? 'x'}`,
    RATE_LIMITS['auth'] ?? { requests: 10, window: '1m' },
  );
  if (!rl.allowed) return errorResponse('RATE_LIMITED', 'Too many auth attempts', 429, true);

  const body = await parseJsonBody(request);
  const email = body['email'];
  if (typeof email !== 'string') return errorResponse('VALIDATION_ERROR', 'email required', 400);

  const sql = createDb(env.NEON_DATABASE_URL);
  let player = await getPlayerByEmail(sql, email);
  if (!player) {
    const rawDisplay = body['displayName'];
    const displayName = typeof rawDisplay === 'string' ? rawDisplay : email.split('@')[0] ?? email;
    player = await createPlayer(sql, email, displayName);
  }
  const token = await signJWT({ sub: player.id, email: player.email }, env.JWT_SECRET);
  return jsonResponse({ player, token });
}

/** GET /figures */
async function handleListFigures(env: Env): Promise<Response> {
  const sql = createDb(env.NEON_DATABASE_URL);
  const figures = await getAllFigures(sql);
  return jsonResponse(figures);
}

/** GET /figures/:id */
async function handleGetFigure(path: string, env: Env): Promise<Response> {
  const id = path.split('/')[2];
  if (!id) return errorResponse('NOT_FOUND', 'Figure not found', 404);
  const sql = createDb(env.NEON_DATABASE_URL);
  const figure = await getFigureById(sql, id);
  if (!figure) return errorResponse('NOT_FOUND', 'Figure not found', 404);
  return jsonResponse(figure);
}

/** GET /decks — authenticated player's decks */
async function handleListDecks(request: Request, env: Env): Promise<Response> {
  const jwt = await authenticateRequest(request, env.JWT_SECRET);
  const sql = createDb(env.NEON_DATABASE_URL);
  const decks = await getDecksByOwner(sql, jwt.sub);
  return jsonResponse(decks);
}

/** POST /decks */
async function handleCreateDeck(request: Request, env: Env): Promise<Response> {
  const jwt = await authenticateRequest(request, env.JWT_SECRET);
  const body = await parseJsonBody(request);
  const name = body['name'];
  const archetypeSchool = body['archetypeSchool'];
  const rawCardIds = body['cardIds'];
  const councilLeaderId = body['councilLeaderId'];
  if (
    typeof name !== 'string' ||
    typeof archetypeSchool !== 'string' ||
    !Array.isArray(rawCardIds) ||
    typeof councilLeaderId !== 'string'
  ) {
    return errorResponse('VALIDATION_ERROR', 'name, archetypeSchool, cardIds, councilLeaderId required', 400);
  }
  const cardIds = rawCardIds.filter((c): c is string => typeof c === 'string');
  const sql = createDb(env.NEON_DATABASE_URL);
  const deck = await createDeck(sql, jwt.sub, name, archetypeSchool, cardIds, councilLeaderId);
  return jsonResponse(deck, 201);
}

/** GET /decks/:id */
async function handleGetDeck(path: string, request: Request, env: Env): Promise<Response> {
  const jwt = await authenticateRequest(request, env.JWT_SECRET);
  const id = path.split('/')[2];
  if (!id) return errorResponse('NOT_FOUND', 'Deck not found', 404);
  const sql = createDb(env.NEON_DATABASE_URL);
  const deck = await getDeckById(sql, id);
  if (!deck) return errorResponse('NOT_FOUND', 'Deck not found', 404);
  if (deck.ownerId !== jwt.sub) return errorResponse('FORBIDDEN', 'Not your deck', 403);
  return jsonResponse(deck);
}

/** POST /matches */
async function handleCreateMatch(request: Request, env: Env): Promise<Response> {
  const jwt = await authenticateRequest(request, env.JWT_SECRET);
  const body = await parseJsonBody(request);
  const deckId = body['deckId'];
  const rawMode = body['mode'];
  const mode: MatchMode = typeof rawMode === 'string' ? (rawMode as MatchMode) : 'transit';
  if (typeof deckId !== 'string') return errorResponse('VALIDATION_ERROR', 'deckId required', 400);

  const sql = createDb(env.NEON_DATABASE_URL);
  const deck = await getDeckById(sql, deckId);
  if (!deck) return errorResponse('NOT_FOUND', 'Deck not found', 404);
  if (deck.ownerId !== jwt.sub) return errorResponse('FORBIDDEN', 'Not your deck', 403);

  const cosmosState = computeCosmosStateFromDate(new Date());
  const activeEvents = detectNamedEvents(cosmosState.planetaryPositions, {
    eclipseActive: cosmosState.eclipseActive,
  });
  const cosmosSnap: CosmosSnapshot = {
    timestamp: new Date(cosmosState.timestamp),
    activeEvents,
    forecast: [],
  };

  let state = initializeMatch({
    player1Id: jwt.sub,
    player2Id: jwt.sub,
    deck1: deck,
    deck2: deck,
    mode,
    cosmosSnapshot: cosmosSnap,
    timestamp: new Date(),
  });
  state = drawOpeningHand(state);

  const matchId = await createMatch(sql, state);
  return jsonResponse({ matchId, state }, 201);
}

/** GET /matches/:id */
async function handleGetMatch(path: string, request: Request, env: Env): Promise<Response> {
  const jwt = await authenticateRequest(request, env.JWT_SECRET);
  const id = path.split('/')[2];
  if (!id) return errorResponse('NOT_FOUND', 'Match not found', 404);
  const sql = createDb(env.NEON_DATABASE_URL);
  const state = await getMatchById(sql, id);
  if (!state) return errorResponse('NOT_FOUND', 'Match not found', 404);
  const isParticipant = state.players.some((p) => p.playerId === jwt.sub);
  if (!isParticipant) return errorResponse('FORBIDDEN', 'Not a match participant', 403);
  return jsonResponse(state);
}
