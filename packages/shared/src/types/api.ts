/**
 * @module @kairos/shared/types/api
 * Types for the API layer — requests, responses, auth.
 */

import type { MatchMode, Archetype } from './game.js';

/** JWT payload structure. */
export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

/** Rate limit configuration. */
export interface RateLimitConfig {
  requests: number;
  window: string;
}

/** Standard API response envelope. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
}

/** API error response body. */
export interface ApiErrorResponse {
  code: string;
  message: string;
  retryable: boolean;
}

/** Match creation request. */
export interface CreateMatchRequest {
  mode: MatchMode;
  deckId: string;
}

/** Match action request. */
export interface MatchActionRequest {
  matchId: string;
  action: MatchActionType;
  payload: Record<string, unknown>;
}

/** All possible match action types. */
export type MatchActionType =
  | 'summon'
  | 'attack'
  | 'playEvent'
  | 'chronosDelay'
  | 'phoenixImmolate'
  | 'dormantAction'
  | 'endTurn';

/** Deck creation/validation request. */
export interface CreateDeckRequest {
  name: string;
  archetypeSchool: Archetype;
  cardIds: string[];
  councilLeaderId: string;
}

/** Rate limits as defined in Security Model. */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { requests: 10, window: '1m' },
  matchAction: { requests: 60, window: '1m' },
  packOpen: { requests: 5, window: '1m' },
  api: { requests: 300, window: '1m' },
} as const;
