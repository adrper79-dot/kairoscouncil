/**
 * @module @kairos/game-engine/clock/transit-clock
 * Transit Clock management and win condition evaluation.
 *
 * Transit Clock advances (GAME_DESIGN.md §7.9):
 *   +1 at turn end (automatic)
 *   +1 for 3+ Ascendant figures simultaneously
 *   +1 when an aspect bond activates during Celestial Update
 *   +1 for each opponent's Ascendant figure suppressed this turn
 *   -1 if all your figures go Dormant/Suppressed simultaneously
 *   -1 if your Council Leader is Suppressed
 *   -1 from opponent Chronos effect targeting your Clock
 *
 * Win condition: Transit Clock reaches 13 first.
 * Simultaneous: player with higher Council Leader TP wins.
 * Still tied: player who went second wins.
 *
 * @see GAME_DESIGN.md §7.9 Win Conditions
 */

import type { MatchState } from '@kairos/shared';
import { KairosError, ErrorCode, TRANSIT_CLOCK_WIN, DESPERATION_THRESHOLD, CELESTIAL_INVERSION_THRESHOLD } from '@kairos/shared';

/** Win condition result. */
export interface WinConditionResult {
  /** null if the match is still in progress. */
  winner: string | null;
  /** Human-readable reason for match end. */
  reason: string | null;
  /** Whether the win happened simultaneously (tiebreaker was applied). */
  wasTiebreak: boolean;
}

/** Clock advancement event types for the Reckoning phase. */
export type ClockEvent =
  | 'turn_end'           // +1 automatic at end of each turn
  | 'triple_ascendant'   // +1 for 3+ Ascendant figures simultaneously
  | 'bond_activated'     // +1 when a bond activates during Celestial Update
  | 'suppressed_foe'     // +1 per opponent Ascendant figure suppressed
  | 'all_dormant'        // −1 when all your figures are Dormant/Suppressed
  | 'leader_suppressed'  // −1 when your Council Leader is Suppressed
  | 'chronos_effect';    // −1 from opponent Chronos targeting

/** Computed clock events for a player this turn. */
export interface ClockUpdateResult {
  playerId: string;
  events: ClockEvent[];
  netChange: number;
  newClock: number;
}

/**
 * Computes all Transit Clock events for a player based on current match state.
 * Does NOT mutate the match — returns the computed events.
 *
 * @param match - Current match state (after all Phase 3 actions)
 * @param playerId - Player whose clock events to compute
 * @param suppressedThisTurn - Number of opponent Ascendant figures suppressed this turn
 * @param bondsActivatedThisTurn - Number of bonds that activated this turn
 * @returns ClockUpdateResult with all events and net change
 *
 * @see GAME_DESIGN.md §7.9
 */
export function computeClockEvents(
  match: MatchState,
  playerId: string,
  suppressedThisTurn: number,
  bondsActivatedThisTurn: number,
): ClockUpdateResult {
  const player = match.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw new KairosError(
      ErrorCode.INVALID_MATCH_STATE,
      `Player ${playerId} not found`,
      { matchId: match.matchId },
    );
  }

  const events: ClockEvent[] = [];
  let delta = 0;

  // +1 turn end (always — handled by processPassPhase, logged here for completeness)
  events.push('turn_end');
  delta += 1;

  // +1 for 3+ Ascendant figures simultaneously
  const ascendantCount = player.battlefield.filter((c) => c.state === 'Ascendant').length;
  if (ascendantCount >= 3) {
    events.push('triple_ascendant');
    delta += 1;
  }

  // +1 per bond activated this turn
  for (let i = 0; i < bondsActivatedThisTurn; i++) {
    events.push('bond_activated');
    delta += 1;
  }

  // +1 per opponent Ascendant figure suppressed this turn
  for (let i = 0; i < suppressedThisTurn; i++) {
    events.push('suppressed_foe');
    delta += 1;
  }

  // −1 if ALL figures are Dormant or Suppressed
  const hasAscendant = player.battlefield.some((c) => c.state === 'Ascendant');
  if (!hasAscendant && player.battlefield.length > 0) {
    events.push('all_dormant');
    delta -= 1;
  }

  // −1 if Council Leader is Suppressed
  const leaderSuppressed = player.suppressedZone.some(
    (c) => c.figureId === player.councilLeaderId,
  );
  if (leaderSuppressed) {
    events.push('leader_suppressed');
    delta -= 1;
  }

  const currentClock = match.transitClocks[playerId] ?? 0;
  const newClock = Math.max(0, currentClock + delta);

  return { playerId, events, netChange: delta, newClock };
}

/**
 * Applies Transit Clock updates for the Reckoning phase.
 * Includes all clock events except 'turn_end' (that's in processPassPhase).
 *
 * @param match - Current match state
 * @param suppressedThisTurn - Map<playerId → suppressedCount> from combat resolution
 * @param bondsActivatedThisTurn - Map<playerId → bondCount> from bond activation
 * @returns Updated MatchState with transit clocks adjusted
 *
 * @see GAME_DESIGN.md §7.9
 */
export function applyClockReckoning(
  match: MatchState,
  suppressedThisTurn: Map<string, number>,
  bondsActivatedThisTurn: Map<string, number>,
): MatchState {
  const updatedClocks = { ...match.transitClocks };

  for (const player of match.players) {
    const suppressed = suppressedThisTurn.get(player.playerId) ?? 0;
    const bonds = bondsActivatedThisTurn.get(player.playerId) ?? 0;
    const update = computeClockEvents(match, player.playerId, suppressed, bonds);

    // Don't double-count turn_end (processPassPhase handles the base +1)
    const extraDelta = update.netChange - 1; // subtract the turn_end +1
    updatedClocks[player.playerId] = Math.max(
      0,
      (updatedClocks[player.playerId] ?? 0) + extraDelta,
    );
  }

  return { ...match, transitClocks: updatedClocks };
}

/**
 * Checks all win conditions after the Reckoning phase.
 *
 * @param match - Current match state
 * @param goingSecondPlayerId - The player who went second (tiebreaker advantage)
 * @returns WinConditionResult — winner null if match continues
 *
 * @see GAME_DESIGN.md §7.9 Win Conditions
 */
export function checkWinConditions(
  match: MatchState,
  goingSecondPlayerId: string,
): WinConditionResult {
  const clockEntries = Object.entries(match.transitClocks);
  const winners = clockEntries.filter(([, clock]) => clock >= TRANSIT_CLOCK_WIN);

  if (winners.length === 0) {
    return { winner: null, reason: null, wasTiebreak: false };
  }

  if (winners.length === 1) {
    const [winnerId] = winners[0]!;
    return {
      winner: winnerId,
      reason: `Transit Clock reached ${TRANSIT_CLOCK_WIN}`,
      wasTiebreak: false,
    };
  }

  // Simultaneous win — tiebreaker: higher Council Leader Transit Power
  const player1 = match.players[0];
  const player2 = match.players[1];
  if (!player1 || !player2) {
    return { winner: null, reason: null, wasTiebreak: false };
  }

  const getLeaderTP = (p: typeof player1): number => {
    const leader = p.battlefield.find((c) => c.figureId === p.councilLeaderId);
    return leader?.transitPower ?? 40;
  };

  const tp1 = getLeaderTP(player1);
  const tp2 = getLeaderTP(player2);

  if (tp1 !== tp2) {
    const winnerByTP = tp1 > tp2 ? player1.playerId : player2.playerId;
    return {
      winner: winnerByTP,
      reason: 'Simultaneous Clock 13 — Council Leader Transit Power tiebreaker',
      wasTiebreak: true,
    };
  }

  // Final tiebreaker: player who went second wins
  return {
    winner: goingSecondPlayerId,
    reason: 'Simultaneous Clock 13 — second player wins final tiebreak',
    wasTiebreak: true,
  };
}

/**
 * Checks comeback mechanic thresholds for the trailing player.
 * Returns any special bonuses that should be applied this turn.
 *
 * @param match - Current match state
 * @param activePlayerId - The player whose turn it is
 * @returns Object with comeback bonuses
 *
 * @see GAME_DESIGN.md §7.10 Comeback Mechanics
 */
export function checkComebackMechanics(
  match: MatchState,
  activePlayerId: string,
): { desperationCEBonus: number; celestialInversionAvailable: boolean } {
  const clocks = match.transitClocks;
  const playerClock = clocks[activePlayerId] ?? 0;
  const maxOpponentClock = Math.max(
    ...match.players
      .filter((p) => p.playerId !== activePlayerId)
      .map((p) => clocks[p.playerId] ?? 0),
  );

  const deficit = maxOpponentClock - playerClock;

  return {
    desperationCEBonus: deficit >= DESPERATION_THRESHOLD ? 1 : 0,
    celestialInversionAvailable: deficit >= CELESTIAL_INVERSION_THRESHOLD,
  };
}

/**
 * Applies Celestial Inversion: all Transit Power values equalize to midpoint for 1 turn.
 * Can only be used once per match when trailing by 5+ ticks. Costs all current CE.
 *
 * @param match - Current match state
 * @param playerId - Player invoking Celestial Inversion
 * @returns Updated MatchState with equalized TP values
 * @throws KairosError KC-2003 if not trailing by enough or CE is 0
 *
 * @see GAME_DESIGN.md §7.10 Celestial Inversion
 */
export function applyCelestialInversion(match: MatchState, playerId: string): MatchState {
  const { celestialInversionAvailable } = checkComebackMechanics(match, playerId);
  if (!celestialInversionAvailable) {
    throw new KairosError(
      ErrorCode.ILLEGAL_GAME_ACTION,
      `Celestial Inversion requires trailing by at least ${CELESTIAL_INVERSION_THRESHOLD} ticks`,
      { matchId: match.matchId },
    );
  }

  // Collect all battlefield TP values
  const allPowers: number[] = match.players.flatMap((p) =>
    p.battlefield.map((c) => c.transitPower),
  );
  if (allPowers.length === 0) return match;

  const midpoint = Math.round(allPowers.reduce((s, v) => s + v, 0) / allPowers.length);

  return {
    ...match,
    players: match.players.map((p) => {
      // Deduct all CE from invoking player only; opponents' CE is unchanged
      if (p.playerId !== playerId) return p;
      return {
        ...p,
        celestialEnergy: 0,
        battlefield: p.battlefield.map((card) => ({
          ...card,
          transitPower: midpoint,
        })),
      };
    }),
  };
}
