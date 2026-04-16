/**
 * @module @kairos/game-engine/combat
 * Damage calculation, suppression, Dormant actions.
 * Implements AC-005: Attack Damage Formula.
 */

import type {
  CardInstance,
  CosmosSnapshot,
  AttackResult,
  ForgeSchool,
  ForgeMatchup,
  ForgeIntensity,
} from '@kairos/shared';
import type { SeededRandom } from '../seed/index.js';

const TRANSIT_POWER_FLOOR = 40;
const TRANSIT_POWER_CEILING = 100;

/** Probability that a square bond misfires on any given attack. */
const SQUARE_MISFIRE_PROBABILITY = 0.5;

/**
 * AC-006: Forge Interaction Matrix.
 * Outer key = attacker forge, inner key = defender forge.
 */
const FORGE_MATRIX: Record<ForgeSchool, Record<ForgeSchool, ForgeMatchup>> = {
  Chronos: {
    Chronos: 'neutral',
    Eros: 'neutral',
    Aether: 'neutral',
    Lux: 'weak',
    Phoenix: 'strong',
  },
  Eros: {
    Chronos: 'weak',
    Eros: 'neutral',
    Aether: 'strong',
    Lux: 'neutral',
    Phoenix: 'neutral',
  },
  Aether: {
    Chronos: 'neutral',
    Eros: 'weak',
    Aether: 'neutral',
    Lux: 'strong',
    Phoenix: 'neutral',
  },
  Lux: {
    Chronos: 'strong',
    Eros: 'neutral',
    Aether: 'neutral',
    Lux: 'neutral',
    Phoenix: 'weak',
  },
  Phoenix: {
    Chronos: 'neutral',
    Eros: 'strong',
    Aether: 'weak',
    Lux: 'neutral',
    Phoenix: 'neutral',
  },
};

const MATCHUP_MODIFIERS: Record<ForgeMatchup, number> = {
  strong: 1.1,
  neutral: 1.0,
  weak: 0.9,
};

/**
 * Returns the forge matchup modifier between two forge schools (AC-006).
 */
export function getForgeMatchup(
  attackerForge: ForgeSchool,
  defenderForge: ForgeSchool,
): ForgeMatchup {
  return FORGE_MATRIX[attackerForge][defenderForge];
}

/**
 * Resolves an attack following AC-005: Attack Damage Formula.
 * Damage = Transit Power × Forge Intensity × Forge Matchup Modifier.
 * Detects square-bond misfire using the provided deterministic RNG (AC-003).
 * The cosmosSnapshot is accepted for future event-based damage modifiers.
 */
export function resolveAttack(
  attacker: CardInstance,
  target: CardInstance,
  cosmosSnapshot: CosmosSnapshot,
  rng: SeededRandom,
): AttackResult {
  // Reserved: cosmosSnapshot supports future event-based damage modifiers (AC-004 roadmap)
  void cosmosSnapshot;

  // Clamp transit power to valid range per AC-004
  const transitPower = Math.min(
    TRANSIT_POWER_CEILING,
    Math.max(TRANSIT_POWER_FLOOR, attacker.transitPower),
  );

  const forgeIntensity: ForgeIntensity = attacker.forgeIntensity.primary;
  const forgeMatchup = getForgeMatchup(attacker.figure.primaryForge, target.figure.primaryForge);
  const matchupModifier = MATCHUP_MODIFIERS[forgeMatchup];

  // AC-005: Attack Damage = Transit Power × Forge Intensity × Forge Matchup Modifier
  const damage = Math.floor(transitPower * forgeIntensity * matchupModifier);

  const targetSuppressed = damage >= target.transitPower;

  // Square bond misfire: volatile bonds between attacker and target may redirect damage
  const hasSquareBond = attacker.activeAspectBonds.some(
    (b) =>
      b.isActive &&
      b.aspectType === 'square' &&
      (b.figure2Id === target.figureId || b.figure1Id === target.figureId),
  );
  const squareMisfired = hasSquareBond && rng.next() < SQUARE_MISFIRE_PROBABILITY;

  return {
    damage,
    transitPower,
    forgeIntensity,
    forgeMatchup,
    matchupModifier,
    targetSuppressed,
    squareMisfired,
    misfireTargetId: undefined,
  };
}

/**
 * Applies an attack result to the target CardInstance, updating its FigureState.
 * - damage >= transitPower → Suppressed
 * - damage >= transitPower × 0.5 → Dormant
 * - damage < transitPower × 0.5 → no state change
 */
export function applyDamage(target: CardInstance, result: AttackResult): CardInstance {
  let newState = target.state;

  if (result.damage >= target.transitPower) {
    newState = 'Suppressed';
  } else if (result.damage >= target.transitPower * 0.5) {
    newState = 'Dormant';
  }

  return { ...target, state: newState };
}
