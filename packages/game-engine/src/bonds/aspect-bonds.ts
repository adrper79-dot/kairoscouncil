/**
 * @module @kairos/game-engine/bonds/aspect-bonds
 * Aspect bond auto-activation, effect application, and Chronos interference.
 *
 * The Fundamental Law: Aspect bonds activate AUTOMATICALLY when:
 *   1. Two figures share a council AND
 *   2. The Cosmos confirms the aspect is within 3° orb.
 * No action. No CE. Fate moves without permission.
 *
 * Bond effects by aspect type (GAME_DESIGN.md §7.6):
 *   Conjunction: both +15 TP, dual-Forge strike
 *   Trine: both +10 TP, +1 bonus CE/turn
 *   Sextile: both +7 TP, one defend while other attacks
 *   Opposition: one +20 TP, other -10 TP (controller chooses each turn)
 *   Square: both +12 TP, 30% misfire chance (deterministic seed)
 *
 * AC-003: Square misfire uses deterministic seed — not Math.random().
 *
 * @see GAME_DESIGN.md §7.6 Aspect Bond Rules
 */

import type {
  MatchState,
  CardInstance,
  AspectBond,
  AspectBondEffect,
  AspectType,
  MatchPlayer,
} from '@kairos/shared';
import {
  KairosError,
  ErrorCode,
  CHRONOS_DELAY_COST,
  MAX_CHRONOS_DELAYS,
  CHRONOS_OVERDELAY_PENALTY,
  TRANSIT_POWER_FLOOR,
} from '@kairos/shared';

/** Bond TP bonuses indexed by aspect type. */
const BOND_TP_BONUS: Record<AspectType, [number, number]> = {
  conjunction: [15, 15],
  trine:       [10, 10],
  sextile:     [7,  7],
  opposition:  [20, -10], // figure1 gets +20, figure2 gets -10 (controller may flip)
  square:      [12, 12],
};

/** Bond CE bonus per turn by aspect type (0 = no bonus). */
const BOND_CE_BONUS: Record<AspectType, number> = {
  conjunction: 0,
  trine:       1,
  sextile:     0,
  opposition:  0,
  square:      0,
};

/**
 * Computes the AspectBondEffect for two figures with a given aspect type.
 *
 * @param aspectType - The type of natal aspect shared between the figures
 * @returns AspectBondEffect with TP bonuses and CE bonus
 */
export function computeBondEffect(aspectType: AspectType): AspectBondEffect {
  const [bonus1, bonus2] = BOND_TP_BONUS[aspectType];
  return {
    transitPowerBonus1: bonus1,
    transitPowerBonus2: bonus2,
    bonusCE: BOND_CE_BONUS[aspectType],
    specialEffect: aspectType === 'conjunction' ? 'dual-forge-strike' :
      aspectType === 'sextile' ? 'simultaneous-defend' : undefined,
  };
}

/**
 * Checks if two figures have a shared natal aspect that is currently confirmed
 * by the cosmos (within 3° orb in the current sky).
 *
 * Match conditions for activation:
 *   - Both figures are Ascendant (or at least Dormant — passive bonds)
 *   - The natal aspect type exists between the two figures
 *   - Current sky confirms the aspect within 3° orb (passed via activeAspects)
 *
 * @param figure1 - First card instance
 * @param figure2 - Second card instance
 * @param confirmedAspectTypes - Set of aspect types currently confirmed by the cosmos
 * @returns AspectType if a valid bond exists, null otherwise
 */
export function detectBondPair(
  figure1: CardInstance,
  figure2: CardInstance,
  confirmedAspectTypes: Set<AspectType>,
): AspectType | null {
  if (figure1.state === 'Suppressed' || figure2.state === 'Suppressed') return null;

  // Check all natal aspects of figure1 against figure2
  for (const natalAspect of figure1.figure.natalAspects) {
    const plansetsMatch =
      (natalAspect.planet1 === figure1.figure.rulingPlanet &&
        natalAspect.planet2 === figure2.figure.rulingPlanet) ||
      (natalAspect.planet2 === figure1.figure.rulingPlanet &&
        natalAspect.planet1 === figure2.figure.rulingPlanet);

    if (plansetsMatch && confirmedAspectTypes.has(natalAspect.type)) {
      return natalAspect.type;
    }
  }

  return null;
}

/**
 * Creates a new AspectBond between two figures.
 *
 * @param figure1Id - First figure ID
 * @param figure2Id - Second figure ID
 * @param aspectType - The natal aspect type forming the bond
 * @returns New AspectBond (inactive by default — activated in the same step)
 */
export function createBond(
  figure1Id: string,
  figure2Id: string,
  aspectType: AspectType,
): AspectBond {
  return {
    figure1Id,
    figure2Id,
    aspectType,
    effect: computeBondEffect(aspectType),
    chronosDelayCount: 0,
    isActive: true,
  };
}

/**
 * Returns the set of aspect types confirmed by the current cosmos.
 * Used to check which natal bonds are currently "lit up" by the sky.
 *
 * @param cosmosActiveAspects - Active sky-to-sky aspects from CosmosState
 * @returns Set of confirmed aspect types in the current sky
 */
export function getConfirmedAspectTypes(
  cosmosActiveAspects: Array<{ type: AspectType }>,
): Set<AspectType> {
  return new Set(cosmosActiveAspects.map((a) => a.type));
}

/**
 * Scans all battlefield pairs for a player and auto-activates eligible bonds.
 * Called during the Celestial Update phase.
 *
 * Only activates bonds between figures on the SAME player's battlefield.
 * (Cross-council bonds are an Eclipse mode feature — Phase 3.)
 *
 * @param player - Player whose battlefield to scan
 * @param confirmedAspectTypes - Aspect types confirmed by current sky
 * @returns Updated player state with new bonds activated
 *
 * @see GAME_DESIGN.md §7.6 — bonds activate automatically
 */
export function activateBondsForPlayer(
  player: MatchPlayer,
  confirmedAspectTypes: Set<AspectType>,
): MatchPlayer {
  const battlefield = player.battlefield;
  const updatedCards = [...battlefield];

  for (let i = 0; i < battlefield.length; i++) {
    for (let j = i + 1; j < battlefield.length; j++) {
      const fig1 = updatedCards[i]!;
      const fig2 = updatedCards[j]!;

      const bondType = detectBondPair(fig1, fig2, confirmedAspectTypes);
      if (!bondType) continue;

      // Check if bond already exists
      const alreadyBonded = fig1.activeAspectBonds.some(
        (b) => b.figure2Id === fig2.figureId && b.aspectType === bondType,
      );
      if (alreadyBonded) continue;

      const newBond = createBond(fig1.figureId, fig2.figureId, bondType);

      updatedCards[i] = {
        ...fig1,
        activeAspectBonds: [...fig1.activeAspectBonds, newBond],
      };
      updatedCards[j] = {
        ...fig2,
        activeAspectBonds: [
          ...fig2.activeAspectBonds,
          { ...newBond, figure1Id: fig2.figureId, figure2Id: fig1.figureId },
        ],
      };
    }
  }

  // Compute CE bonus from active bonds for this turn
  const ceFromBonds = updatedCards.reduce((sum, card) => {
    const bondCE = card.activeAspectBonds
      .filter((b) => b.isActive && b.figure1Id === card.figureId)
      .reduce((s, b) => s + b.effect.bonusCE, 0);
    return sum + bondCE;
  }, 0);

  return {
    ...player,
    battlefield: updatedCards,
    celestialEnergy: Math.min(7, player.celestialEnergy + ceFromBonds),
  };
}

/**
 * Activates all eligible bonds across both players' battlefields.
 * Called during Phase 1 (Celestial Update) — cannot be skipped.
 *
 * @param match - Current match state
 * @param confirmedAspectTypes - Aspect types active in the cosmos right now
 * @returns Updated MatchState with all new bonds activated
 *
 * @see GAME_DESIGN.md §7.6 — bonds activate during Celestial Update
 */
export function activateAllBonds(
  match: MatchState,
  confirmedAspectTypes: Set<AspectType>,
): MatchState {
  return {
    ...match,
    players: match.players.map((player) =>
      activateBondsForPlayer(player, confirmedAspectTypes),
    ),
  };
}

/**
 * Removes expired bonds — bonds whose aspect is no longer within 3° orb.
 * Called after Celestial Update when the cosmos has changed.
 *
 * @param match - Current match state
 * @param confirmedAspectTypes - Currently confirmed aspect types
 * @returns Updated MatchState with expired bonds removed
 */
export function expireStaleBonds(
  match: MatchState,
  confirmedAspectTypes: Set<AspectType>,
): MatchState {
  return {
    ...match,
    players: match.players.map((player) => ({
      ...player,
      battlefield: player.battlefield.map((card) => ({
        ...card,
        activeAspectBonds: card.activeAspectBonds.filter((bond) =>
          confirmedAspectTypes.has(bond.aspectType),
        ),
      })),
    })),
  };
}

/**
 * Processes a Chronos Delay action on a specific aspect bond.
 * Cost: 2 CE. Delays the bond by 1 turn.
 * Maximum 3 consecutive delays; after 3, bond activates regardless
 * and the Chronos figure loses 10 Transit Power.
 *
 * @param match - Current match state
 * @param playerId - Player performing the delay (must have a Chronos Ascendant figure)
 * @param targetBondFigureId - Figure on opponent's battlefield whose bond is being delayed
 * @param bondAspectType - The aspect type of the bond being targeted
 * @returns Updated MatchState
 * @throws KairosError KC-2005 if insufficient CE
 *
 * @see GAME_DESIGN.md §7.6 Chronos Interference
 * @see AC-007 — Chronos delay costs 2 CE
 */
export function processChronosDelay(
  match: MatchState,
  playerId: string,
  targetBondFigureId: string,
  bondAspectType: AspectType,
): MatchState {
  const activePlayer = match.players.find((p) => p.playerId === playerId);
  if (!activePlayer) {
    throw new KairosError(ErrorCode.INVALID_MATCH_STATE, `Player ${playerId} not found`);
  }

  if (activePlayer.celestialEnergy < CHRONOS_DELAY_COST) {
    throw new KairosError(
      ErrorCode.CE_INSUFFICIENT,
      `Chronos delay costs ${CHRONOS_DELAY_COST} CE; have ${activePlayer.celestialEnergy}`,
      { required: CHRONOS_DELAY_COST, available: activePlayer.celestialEnergy },
    );
  }

  // Find the Chronos figure on the active player's battlefield (for penalty)
  const chronosFigure = activePlayer.battlefield.find(
    (c) => c.figure.primaryForge === 'Chronos' && c.state === 'Ascendant',
  );

  // Check whether the targeted bond will exceed max delays after this action
  const opponent = match.players.find((p) => p.playerId !== playerId);
  if (!opponent) {
    throw new KairosError(ErrorCode.INVALID_MATCH_STATE, 'No opponent found');
  }

  const targetFigure = opponent.battlefield.find((c) => c.figureId === targetBondFigureId);
  const targetBond = targetFigure?.activeAspectBonds.find(
    (b) => b.aspectType === bondAspectType,
  );
  const newDelayCount = (targetBond?.chronosDelayCount ?? 0) + 1;
  const fateAsserts = newDelayCount >= MAX_CHRONOS_DELAYS;

  return {
    ...match,
    players: match.players.map((p) => {
      if (p.playerId === playerId) {
        // Deduct CE and apply penalty to Chronos figure if fate asserts
        return {
          ...p,
          celestialEnergy: p.celestialEnergy - CHRONOS_DELAY_COST,
          battlefield: p.battlefield.map((c) => {
            if (!fateAsserts || !chronosFigure || c.figureId !== chronosFigure.figureId) {
              return c;
            }
            // Fate asserts — Chronos figure loses 10 Transit Power (AC-007)
            return {
              ...c,
              transitPower: Math.max(TRANSIT_POWER_FLOOR, c.transitPower - CHRONOS_OVERDELAY_PENALTY),
            };
          }),
        };
      }

      if (p.playerId !== opponent.playerId) return p;

      // Update the targeted bond on opponent's battlefield
      return {
        ...p,
        battlefield: p.battlefield.map((card) => {
          if (card.figureId !== targetBondFigureId) return card;
          return {
            ...card,
            activeAspectBonds: card.activeAspectBonds.map((bond) => {
              if (bond.aspectType !== bondAspectType) return bond;
              // Fate asserts: bond activates regardless; otherwise deactivated for 1 turn
              return {
                ...bond,
                isActive: fateAsserts,
                chronosDelayCount: newDelayCount,
              };
            }),
          };
        }),
      };
    }),
  };
}
