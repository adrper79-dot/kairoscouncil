/**
 * @module @kairos/game-engine/match/turn-resolution
 * Turn phase processing — Celestial Update, Draw, Council, Reckoning, Pass.
 *
 * AC-002: All state mutations are server-side.
 * AC-007: CE income = 3 base + carryover (max 1) + event bonuses (max 7 total).
 *
 * Turn structure (GAME_DESIGN.md §7.3):
 *   Phase 1 — CELESTIAL UPDATE (cannot be skipped)
 *   Phase 2 — THE DRAW
 *   Phase 3 — THE COUNCIL (main phase)
 *   Phase 4 — THE RECKONING
 *   Phase 5 — THE PASS
 */

import type { MatchState, MatchPlayer, CosmosSnapshot, CardInstance, CelestialEventName } from '@kairos/shared';
import {
  KairosError,
  ErrorCode,
  BASE_CE_PER_TURN,
  MAX_CE_CARRYOVER,
  MAX_CE,
  ASCENDANT_THRESHOLD,
  TRANSIT_POWER_FLOOR,
  TRANSIT_POWER_CEILING,
} from '@kairos/shared';

/**
 * Result of a Celestial Update — updated battlefield + new CE allocation.
 */
export interface CelestialUpdateResult {
  updatedPlayers: MatchPlayer[];
  ceBonus: number;
  activeEvents: CelestialEventName[];
}

/**
 * Computes the CE income for the active player at turn start.
 * Formula: min(MAX_CE, BASE_CE + carryover + eventBonuses)
 *
 * @param player - Active player state
 * @param activeEventCount - Number of currently active named celestial events
 * @returns CE available for this turn
 *
 * @see AC-007 — Celestial Energy Economy
 */
export function computeCEIncome(player: MatchPlayer, activeEventCount: number): number {
  const carryover = Math.min(player.carryoverCE, MAX_CE_CARRYOVER);
  const raw = BASE_CE_PER_TURN + carryover + activeEventCount;
  return Math.min(MAX_CE, raw);
}

/**
 * Applies the Celestial Update to all figures on the battlefield.
 * Updates transitPower and figureState from the new cosmos snapshot.
 *
 * In Phase 1+, this calls the transit cache. For Phase 0, the snapshot
 * already contains the updated powers (passed in by the caller).
 *
 * @param match - Current match state
 * @param updatedPowers - Map<figureId → new transitPower> from transit cache
 * @param cosmos - New cosmos snapshot
 * @returns Updated players with refreshed card states
 *
 * @see AC-009 — Cosmos refreshes at match start and each turn's Celestial Update
 */
export function applyCelestialUpdate(
  match: MatchState,
  updatedPowers: Map<string, number>,
  cosmos: CosmosSnapshot,
): CelestialUpdateResult {
  const activeEvents = cosmos.activeEvents;
  const ceBonus = activeEvents.length;

  const updatedPlayers = match.players.map((player) => ({
    ...player,
    battlefield: player.battlefield.map((card) => {
      const newPower = updatedPowers.get(card.figureId) ?? card.transitPower;
      const clampedPower = Math.max(TRANSIT_POWER_FLOOR, Math.min(TRANSIT_POWER_CEILING, newPower));
      const newState = determineStateFromPower(card, clampedPower);
      return { ...card, transitPower: clampedPower, state: newState };
    }),
  }));

  return { updatedPlayers, ceBonus, activeEvents };
}

/**
 * Determines figure state from its current Transit Power.
 * Suppressed state is only cleared by the game engine (not power alone).
 *
 * Rules (GAME_DESIGN.md §7.5):
 * - Ascendant: TP ≥ 60
 * - Dormant: TP < 60
 * - Suppressed: set by combat resolution, NOT reversed by power increase alone
 *
 * @param card - Current card instance
 * @param newPower - Newly computed Transit Power
 * @returns Updated FigureState
 */
export function determineStateFromPower(
  card: CardInstance,
  newPower: number,
): CardInstance['state'] {
  // Suppressed can only be cleared by Phoenix self-immolation or Green World Burst
  if (card.state === 'Suppressed') return 'Suppressed';
  return newPower >= ASCENDANT_THRESHOLD ? 'Ascendant' : 'Dormant';
}

/**
 * Processes Phase 1: CELESTIAL UPDATE + CE income computation.
 * Always executes first; cannot be skipped or modified.
 *
 * @param match - Current match state before the turn
 * @param updatedPowers - Transit Power updates from the cache for all battlefield figures
 * @param cosmos - New cosmos snapshot for this turn
 * @returns Updated MatchState with refreshed CE and figure states
 *
 * @see AC-009 — Cosmos refreshes at each turn's Celestial Update
 */
export function processCelestialUpdatePhase(
  match: MatchState,
  updatedPowers: Map<string, number>,
  cosmos: CosmosSnapshot,
): MatchState {
  const { updatedPlayers, ceBonus } = applyCelestialUpdate(match, updatedPowers, cosmos);

  // Apply CE income to active player
  return {
    ...match,
    players: updatedPlayers.map((player) => {
      if (player.playerId !== match.activePlayerId) return player;
      const ce = computeCEIncome(player, ceBonus);
      return { ...player, celestialEnergy: ce, carryoverCE: 0 };
    }),
    cosmosSnapshot: cosmos,
  };
}

/**
 * Processes Phase 2: THE DRAW.
 * Active player draws 1 card. Empty deck = no draw, no penalty.
 *
 * @param match - Current match state
 * @returns Updated MatchState with active player's hand increased by 1
 *
 * @see GAME_DESIGN.md §7.3
 */
export function processDrawPhase(match: MatchState): MatchState {
  return {
    ...match,
    players: match.players.map((player) => {
      if (player.playerId !== match.activePlayerId) return player;
      if (player.deck.length === 0) return player; // Empty deck — no draw, no penalty

      const [drawn, ...remainingDeck] = player.deck;
      return {
        ...player,
        deck: remainingDeck,
        hand: [...player.hand, drawn!],
      };
    }),
  };
}

/**
 * Processes Phase 5: THE PASS.
 * - Transit Clock +1 for active player (additional increments from combat resolved separately)
 * - Carryover CE: active player may carry max 1 unused CE to next turn
 * - Switches active player
 * - Increments turn counter
 *
 * @param match - Current match state after all Phase 3 actions
 * @returns Updated MatchState with turn advanced
 *
 * @see GAME_DESIGN.md §7.3 — Transit Clock +1 at end of each turn
 * @see AC-007 — max 1 CE carryover
 */
export function processPassPhase(match: MatchState): MatchState {
  const activePlayerId = match.activePlayerId;
  const otherPlayerId = match.players.find((p) => p.playerId !== activePlayerId)?.playerId;

  if (!otherPlayerId) {
    throw new KairosError(
      ErrorCode.INVALID_MATCH_STATE,
      'Cannot find opponent player in match state',
      { matchId: match.matchId },
    );
  }

  // Transit Clock +1 for active player at end of turn (base increment)
  const newClocks = {
    ...match.transitClocks,
    [activePlayerId]: (match.transitClocks[activePlayerId] ?? 0) + 1,
  };

  // CE carryover: active player keeps max 1 unused CE
  const updatedPlayers = match.players.map((player) => {
    if (player.playerId !== activePlayerId) return player;
    return {
      ...player,
      carryoverCE: Math.min(player.celestialEnergy, MAX_CE_CARRYOVER),
      celestialEnergy: 0,
      // Reset dormant action flags and decrement Phoenix Reborn immunity counter
      battlefield: player.battlefield.map((card) => ({
        ...card,
        dormantActionUsed: false,
        // Decrement Phoenix Reborn immunity counter (GAME_DESIGN.md §7.7)
        // 0 = no immunity; > 0 = immune to Eros/Aether for this many more turns
        phoenixRebornTurns: card.phoenixRebornTurns > 0
          ? card.phoenixRebornTurns - 1
          : 0,
      })),
    };
  });

  return {
    ...match,
    turn: match.turn + 1,
    activePlayerId: otherPlayerId,
    players: updatedPlayers,
    transitClocks: newClocks,
  };
}

/**
 * Summons a figure from hand to battlefield.
 * Deducts CE equal to the figure's Forge Intensity.
 *
 * @param match - Current match state
 * @param playerId - Player performing the summon
 * @param figureId - Figure card ID to summon
 * @param cardInstance - Pre-created CardInstance (from transit cache)
 * @returns Updated MatchState
 * @throws KairosError KC-2005 if insufficient CE
 * @throws KairosError KC-2003 if figure not in hand
 *
 * @see AC-007 — Summon cost = Forge Intensity (1–3)
 */
export function summonFigure(
  match: MatchState,
  playerId: string,
  figureId: string,
  cardInstance: CardInstance,
): MatchState {
  const player = match.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw new KairosError(ErrorCode.INVALID_MATCH_STATE, `Player ${playerId} not found`, { matchId: match.matchId });
  }

  if (!player.hand.includes(figureId)) {
    throw new KairosError(
      ErrorCode.ILLEGAL_GAME_ACTION,
      `Figure ${figureId} is not in hand`,
      { playerId, hand: player.hand },
    );
  }

  const cost = cardInstance.forgeIntensity.primary;
  if (player.celestialEnergy < cost) {
    throw new KairosError(
      ErrorCode.CE_INSUFFICIENT,
      `Insufficient CE: need ${cost}, have ${player.celestialEnergy}`,
      { playerId, required: cost, available: player.celestialEnergy },
    );
  }

  return {
    ...match,
    players: match.players.map((p) => {
      if (p.playerId !== playerId) return p;
      return {
        ...p,
        hand: p.hand.filter((id) => id !== figureId),
        battlefield: [...p.battlefield, cardInstance],
        celestialEnergy: p.celestialEnergy - cost,
      };
    }),
  };
}
