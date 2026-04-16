/**
 * @module @kairos/game-engine/match
 * Match initialization, state management, turn resolution.
 * AC-002: Server-side authority. AC-003: Deterministic seeds.
 */

import type {
  MatchState,
  MatchPlayer,
  CosmosSnapshot,
  CelestialEventName,
  Deck,
  MatchMode,
} from '@kairos/shared';
import { SeededRandom, createMatchSeed, bigintToSeed } from '../seed/index.js';
import { detectAspectBonds } from '../bonds/index.js';

const OPENING_HAND_SIZE = 5;
const CE_BASE = 3;
const CE_MAX = 7;
const CE_CARRYOVER_MAX = 1;

/** Generates a deterministic match ID from player IDs and timestamp. */
function generateMatchId(player1Id: string, player2Id: string, timestamp: Date): string {
  return `match-${player1Id.slice(-6)}-${player2Id.slice(-6)}-${timestamp.getTime().toString(16)}`;
}

/**
 * Calculates base Celestial Energy for the current turn before carryover (AC-007).
 * Base: 3 CE + 1 per active celestial event. Carryover and max cap applied in startTurn.
 */
export function calculateCeForTurn(activeEvents: CelestialEventName[]): number {
  return CE_BASE + activeEvents.length;
}

/**
 * Initialises a new match from two player IDs, their decks, the game mode, a cosmos
 * snapshot, and a timestamp. Decks are shuffled deterministically using the timestamp
 * seed (AC-003). Returns the authoritative initial MatchState (AC-002).
 */
export function initializeMatch(params: {
  player1Id: string;
  player2Id: string;
  deck1: Deck;
  deck2: Deck;
  mode: MatchMode;
  cosmosSnapshot: CosmosSnapshot;
  timestamp: Date;
}): MatchState {
  const seed = createMatchSeed(params.timestamp);
  const rng = new SeededRandom(bigintToSeed(seed));

  const shuffledDeck1 = rng.shuffle(params.deck1.cardIds);
  const shuffledDeck2 = rng.shuffle(params.deck2.cardIds);

  const player1: MatchPlayer = {
    playerId: params.player1Id,
    deck: shuffledDeck1,
    hand: [],
    battlefield: [],
    suppressedZone: [],
    councilLeaderId: params.deck1.councilLeaderId,
    celestialEnergy: CE_BASE,
    carryoverCE: 0,
  };

  const player2: MatchPlayer = {
    playerId: params.player2Id,
    deck: shuffledDeck2,
    hand: [],
    battlefield: [],
    suppressedZone: [],
    councilLeaderId: params.deck2.councilLeaderId,
    celestialEnergy: CE_BASE,
    carryoverCE: 0,
  };

  // Eclipse mode uses a single shared clock; transit/chart use per-player clocks.
  const transitClocks: Record<string, number> =
    params.mode === 'eclipse'
      ? { eclipse: 0 }
      : { [params.player1Id]: 0, [params.player2Id]: 0 };

  return {
    matchId: generateMatchId(params.player1Id, params.player2Id, params.timestamp),
    mode: params.mode,
    seed,
    seedTimestamp: params.timestamp,
    turn: 0,
    activePlayerId: params.player1Id,
    players: [player1, player2],
    cosmosSnapshot: params.cosmosSnapshot,
    transitClocks,
  };
}

/**
 * Draws the opening hand of 5 cards for each player from their shuffled deck.
 * Must be called once after initializeMatch and before the first startTurn.
 */
export function drawOpeningHand(state: MatchState): MatchState {
  const updatedPlayers = state.players.map((player) => {
    const hand = player.deck.slice(0, OPENING_HAND_SIZE);
    const deck = player.deck.slice(OPENING_HAND_SIZE);
    return { ...player, hand, deck };
  });

  return { ...state, players: updatedPlayers };
}

/**
 * Advances the match to the next turn:
 * - Increments the turn counter.
 * - Updates the cosmos snapshot.
 * - For the active player: draws 1 card and calculates CE with carryover (AC-007).
 * - For all players: re-detects aspect bonds on their battlefields and updates
 *   activeAspectBonds on each CardInstance (bond TP effects are applied on demand
 *   via applyBondEffects — transitPower in CardInstance remains the raw value).
 */
export function startTurn(state: MatchState, cosmosSnapshot: CosmosSnapshot): MatchState {
  const updatedPlayers = state.players.map((player) => {
    const isActive = player.playerId === state.activePlayerId;

    // Re-detect bonds for this player's battlefield and attach them to each card
    const newBonds = detectAspectBonds(player.battlefield, cosmosSnapshot);
    const updatedBattlefield = player.battlefield.map((card) => {
      const cardBonds = newBonds.filter(
        (b) => b.figure1Id === card.figureId || b.figure2Id === card.figureId,
      );
      return { ...card, activeAspectBonds: cardBonds };
    });

    if (!isActive) {
      return { ...player, battlefield: updatedBattlefield };
    }

    // Draw 1 card from the active player's deck
    const [drawnCard, ...remainingDeck] = player.deck;
    const newHand = drawnCard !== undefined ? [...player.hand, drawnCard] : player.hand;
    const newDeck = drawnCard !== undefined ? remainingDeck : player.deck;

    // AC-007: CE = min(base + events + carryover(max 1), 7)
    const carryover = Math.min(player.carryoverCE, CE_CARRYOVER_MAX);
    const newCE = Math.min(calculateCeForTurn(cosmosSnapshot.activeEvents) + carryover, CE_MAX);

    return {
      ...player,
      battlefield: updatedBattlefield,
      hand: newHand,
      deck: newDeck,
      celestialEnergy: newCE,
      carryoverCE: 0,
    };
  });

  return {
    ...state,
    turn: state.turn + 1,
    cosmosSnapshot,
    players: updatedPlayers,
  };
}
