/**
 * @module @kairos/game-engine/clock
 * Transit Clock management and win condition evaluation.
 * Target: 13 for 1v1, 12 for Eclipse Harmonic.
 */

import type { MatchState, MatchMode, ForgeSchool } from '@kairos/shared';

const CLOCK_TARGET_STANDARD = 13;
const CLOCK_TARGET_ECLIPSE = 12;

/** Shared clock key used when mode === 'eclipse'. */
const ECLIPSE_CLOCK_KEY = 'eclipse';

/** AC-008: Lux distortion range applied to clock display (±1). */
const LUX_DISTORTION_RANGE = 1;

/**
 * Returns the transit clock target for the given match mode.
 * 13 for transit/chart (1v1), 12 for eclipse (co-op).
 */
export function getClockTarget(mode: MatchMode): number {
  return mode === 'eclipse' ? CLOCK_TARGET_ECLIPSE : CLOCK_TARGET_STANDARD;
}

/**
 * Ticks the transit clock +1 for a successful suppression event.
 * In eclipse mode the shared clock advances regardless of which player suppressed.
 * In transit/chart mode only the specified player's clock advances.
 */
export function tickTransitClock(state: MatchState, playerId: string): MatchState {
  const updatedClocks = { ...state.transitClocks };

  if (state.mode === 'eclipse') {
    const current = updatedClocks[ECLIPSE_CLOCK_KEY] ?? 0;
    updatedClocks[ECLIPSE_CLOCK_KEY] = current + 1;
  } else {
    const current = updatedClocks[playerId] ?? 0;
    updatedClocks[playerId] = current + 1;
  }

  return { ...state, transitClocks: updatedClocks };
}

/**
 * Checks win conditions for the current match state.
 * Returns the winning player ID if a clock has reached its target, otherwise null.
 * In eclipse mode returns 'eclipse' to signal the co-op players have won.
 */
export function checkWinCondition(state: MatchState): string | null {
  const target = getClockTarget(state.mode);

  if (state.mode === 'eclipse') {
    const clock = state.transitClocks[ECLIPSE_CLOCK_KEY] ?? 0;
    return clock >= target ? ECLIPSE_CLOCK_KEY : null;
  }

  for (const player of state.players) {
    const clock = state.transitClocks[player.playerId] ?? 0;
    if (clock >= target) return player.playerId;
  }

  return null;
}

/**
 * Returns the clock value for display.
 * AC-008 Lux Distortion: when the viewer's forge is Lux, the clock is shown as a
 * ±1 range rather than an exact number, preventing precise clock-reading.
 */
export function getClockDisplay(
  state: MatchState,
  playerId: string,
  viewerForge?: ForgeSchool,
): number | { min: number; max: number } {
  const clockValue =
    state.mode === 'eclipse'
      ? (state.transitClocks[ECLIPSE_CLOCK_KEY] ?? 0)
      : (state.transitClocks[playerId] ?? 0);

  if (viewerForge === 'Lux') {
    return {
      min: Math.max(0, clockValue - LUX_DISTORTION_RANGE),
      max: clockValue + LUX_DISTORTION_RANGE,
    };
  }

  return clockValue;
}
