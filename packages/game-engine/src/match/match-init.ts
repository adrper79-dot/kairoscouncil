/**
 * @module @kairos/game-engine/match/match-init
 * Match initialization — deck validation, seeding, setup, first-player determination.
 *
 * AC-002: All game state is authoritative server-side.
 * AC-003: Match seed generated at initiation — all subsequent randomness uses this seed.
 * AC-007: Initial CE = 3 per player.
 *
 * @see GAME_DESIGN.md §7.2 Match Setup
 * @see GAME_DESIGN.md §7.1 Deck Construction
 */

import type {
  MatchState,
  MatchPlayer,
  MatchMode,
  CardInstance,
  HistoricalFigure,
  CosmosSnapshot,
  FigureState,
} from '@kairos/shared';
import {
  KairosError,
  ErrorCode,
  OPENING_HAND_SIZE,
  DECK_SIZE,
  MAX_FIGURE_COPIES,
  MIN_DISTINCT_FIGURES,
  BASE_CE_PER_TURN,
  ASCENDANT_THRESHOLD,
  TRANSIT_POWER_FLOOR,
} from '@kairos/shared';
import { SeededRandom, generateMatchSeed } from '../seed/seed.js';

/** Deck validation result. */
export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

/** Input deck for match initialization. */
export interface DeckInput {
  ownerId: string;
  cardIds: string[];
  councilLeaderId: string;
  archetypeSchool: string;
  figures: HistoricalFigure[];
}

/** Input for initializing a match. */
export interface InitMatchInput {
  mode: MatchMode;
  player1Deck: DeckInput;
  player2Deck: DeckInput;
  cosmosSnapshot: CosmosSnapshot;
  /** Optional fixed timestamp for deterministic testing. */
  overrideTimestamp?: Date;
}

/**
 * Validates a deck against construction rules (GAME_DESIGN.md §7.1).
 * Must pass before match initialization is allowed.
 *
 * Checks:
 * - Exactly 20 cards
 * - Max 2 copies of any single figure
 * - Min 4 distinct figures
 * - Council leader must be in the deck
 *
 * @param deck - Deck input to validate
 * @returns DeckValidationResult with errors array
 *
 * @see GAME_DESIGN.md §7.1 Deck Construction
 */
export function validateDeck(deck: DeckInput): DeckValidationResult {
  const errors: string[] = [];

  // Rule: Exactly 20 cards
  if (deck.cardIds.length !== DECK_SIZE) {
    errors.push(`Deck must contain exactly ${DECK_SIZE} cards; got ${deck.cardIds.length}`);
  }

  // Rule: Max 2 copies of any single figure
  const copyCounts = new Map<string, number>();
  for (const id of deck.cardIds) {
    copyCounts.set(id, (copyCounts.get(id) ?? 0) + 1);
  }
  for (const [figureId, count] of copyCounts) {
    if (count > MAX_FIGURE_COPIES) {
      errors.push(`Figure ${figureId} appears ${count} times (max ${MAX_FIGURE_COPIES})`);
    }
  }

  // Rule: Min 4 distinct figures
  if (copyCounts.size < MIN_DISTINCT_FIGURES) {
    errors.push(`Deck must contain at least ${MIN_DISTINCT_FIGURES} distinct figures; got ${copyCounts.size}`);
  }

  // Rule: Max 4 Event cards (tracked separately in a full implementation)
  // For Phase 0, all cards are figures — Event cards are Phase 1+

  // Rule: Council leader must be in the deck
  if (!deck.cardIds.includes(deck.councilLeaderId)) {
    errors.push(`Council leader ${deck.councilLeaderId} is not in the deck`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determines which player goes first.
 * Rule: Higher Council Leader Transit Power goes first.
 * Tiebreaker: Solar Return proximity (solarReturnActive wins).
 * Second tiebreaker: player1 goes first (arbitrary).
 *
 * @param leader1 - Player 1's Council Leader card
 * @param leader2 - Player 2's Council Leader card
 * @param player1Id - Player 1 ID
 * @param player2Id - Player 2 ID
 * @returns The ID of the player who goes first
 *
 * @see GAME_DESIGN.md §7.2 Match Setup
 */
export function determineFirstPlayer(
  leader1: CardInstance,
  leader2: CardInstance,
  player1Id: string,
  player2Id: string,
): string {
  if (leader1.transitPower > leader2.transitPower) return player1Id;
  if (leader2.transitPower > leader1.transitPower) return player2Id;
  // Tiebreaker: solar return
  // solarReturnActive is not on CardInstance directly — it would be in the cache entry
  // For now, default to player1
  return player1Id;
}

/**
 * Converts a HistoricalFigure to a CardInstance with current transit data.
 * The transitPower should come from the TransitCache for this figure.
 *
 * @param figure - Historical figure card definition
 * @param transitPower - Current Transit Power from cache (AC-009)
 * @param forgeIntensity - Current Forge Intensity from cache
 * @returns CardInstance ready for match play
 */
export function createCardInstance(
  figure: HistoricalFigure,
  transitPower: number,
  forgeIntensity: CardInstance['forgeIntensity'],
): CardInstance {
  const state: FigureState = transitPower >= ASCENDANT_THRESHOLD ? 'Ascendant' : 'Dormant';
  return {
    figureId: figure.id,
    figure,
    transitPower,
    state,
    forgeIntensity,
    activeAspectBonds: [],
    phoenixRebornTurns: 0,
    dormantActionUsed: false,
  };
}

/**
 * Initializes a new match from two decks and a cosmos snapshot.
 *
 * Steps (GAME_DESIGN.md §7.2):
 *   1. Validate both decks
 *   2. Generate deterministic seed from timestamp
 *   3. Shuffle both decks using the seed
 *   4. Deal opening hands (5 cards each)
 *   5. Set initial CE (3 per player)
 *   6. Determine first player
 *   7. Assemble MatchState
 *
 * @param input - Match initialization parameters
 * @returns Initialized MatchState (server-side authoritative)
 * @throws KairosError KC-2003 if either deck is invalid
 * @throws KairosError KC-2002 if seed generation fails
 *
 * @see AC-002 — server authority
 * @see AC-003 — deterministic seeds
 * @see AC-007 — initial CE = 3
 */
export function initializeMatch(input: InitMatchInput): MatchState {
  const { mode, player1Deck, player2Deck, cosmosSnapshot, overrideTimestamp } = input;

  // ── Validate decks ────────────────────────────────────────────────────────
  const v1 = validateDeck(player1Deck);
  const v2 = validateDeck(player2Deck);

  if (!v1.valid || !v2.valid) {
    throw new KairosError(
      ErrorCode.ILLEGAL_GAME_ACTION,
      'Invalid deck(s) — match cannot be initialized',
      { player1Errors: v1.errors, player2Errors: v2.errors },
    );
  }

  // ── Generate deterministic seed ──────────────────────────────────────────
  const seedTimestamp = overrideTimestamp ?? new Date();
  const seed = generateMatchSeed(seedTimestamp, player1Deck.ownerId + player2Deck.ownerId);
  const rng = new SeededRandom(seed);

  // ── Shuffle decks ────────────────────────────────────────────────────────
  const shuffled1 = rng.shuffle(player1Deck.cardIds);
  const shuffled2 = rng.shuffle(player2Deck.cardIds);

  // ── Deal opening hands ───────────────────────────────────────────────────
  const hand1 = shuffled1.slice(0, OPENING_HAND_SIZE);
  const deck1 = shuffled1.slice(OPENING_HAND_SIZE);

  const hand2 = shuffled2.slice(0, OPENING_HAND_SIZE);
  const deck2 = shuffled2.slice(OPENING_HAND_SIZE);

  // ── Council Leaders (determine first player) ─────────────────────────────
  const leaderFigure1 = player1Deck.figures.find((f) => f.id === player1Deck.councilLeaderId);
  const leaderFigure2 = player2Deck.figures.find((f) => f.id === player2Deck.councilLeaderId);

  if (!leaderFigure1 || !leaderFigure2) {
    throw new KairosError(
      ErrorCode.ILLEGAL_GAME_ACTION,
      'Council leader figure not found in provided figures array',
      { leader1: player1Deck.councilLeaderId, leader2: player2Deck.councilLeaderId },
    );
  }

  // Council leaders enter at base Transit Power (will be refreshed on first turn)
  const leader1Card = createCardInstance(leaderFigure1, TRANSIT_POWER_FLOOR, { primary: 1, secondary: null });
  const leader2Card = createCardInstance(leaderFigure2, TRANSIT_POWER_FLOOR, { primary: 1, secondary: null });

  const firstPlayerId = determineFirstPlayer(
    leader1Card, leader2Card,
    player1Deck.ownerId, player2Deck.ownerId,
  );

  // ── Assemble player states ───────────────────────────────────────────────
  const player1State: MatchPlayer = {
    playerId: player1Deck.ownerId,
    deck: deck1,
    hand: hand1,
    battlefield: [],
    suppressedZone: [],
    councilLeaderId: player1Deck.councilLeaderId,
    celestialEnergy: BASE_CE_PER_TURN,
    carryoverCE: 0,
  };

  const player2State: MatchPlayer = {
    playerId: player2Deck.ownerId,
    deck: deck2,
    hand: hand2,
    battlefield: [],
    suppressedZone: [],
    councilLeaderId: player2Deck.councilLeaderId,
    celestialEnergy: BASE_CE_PER_TURN,
    carryoverCE: 0,
  };

  // ── Match ID ─────────────────────────────────────────────────────────────
  // Phase 0: generate a deterministic ID from seed; Phase 1+: DB-assigned UUID
  // Ensure hex string is exactly 32 chars before formatting as UUID-style
  const matchIdHex = (BigInt(seed) ^ BigInt(seedTimestamp.getTime()))
    .toString(16)
    .padStart(32, '0')
    .slice(0, 32);
  const matchId = matchIdHex.replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5',
  );

  return {
    matchId,
    mode,
    seed,
    seedTimestamp,
    turn: 0,
    activePlayerId: firstPlayerId,
    players: [player1State, player2State],
    cosmosSnapshot,
    transitClocks: {
      [player1Deck.ownerId]: 0,
      [player2Deck.ownerId]: 0,
    },
    winner: undefined,
    completedAt: undefined,
  };
}
