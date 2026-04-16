/**
 * @module @kairos/game-engine/bonds
 * Aspect bond logic, auto-activation, Chronos interference.
 * Bonds activate automatically — no action, no CE required.
 */

import type {
  CardInstance,
  CosmosSnapshot,
  AspectBond,
  AspectBondEffect,
  AspectType,
} from '@kairos/shared';

const TRANSIT_POWER_CEILING = 100;
const TRANSIT_POWER_FLOOR = 40;

/**
 * Returns the AspectBondEffect for a given aspect type.
 * Bonuses are symmetric (bonus1 === bonus2) per game design spec.
 */
export function calculateBondEffect(aspectType: AspectType): AspectBondEffect {
  switch (aspectType) {
    case 'conjunction':
      return { transitPowerBonus1: 8, transitPowerBonus2: 8, bonusCE: 2 };
    case 'opposition':
      return { transitPowerBonus1: 5, transitPowerBonus2: 5, bonusCE: 1 };
    case 'trine':
      return { transitPowerBonus1: 6, transitPowerBonus2: 6, bonusCE: 1 };
    case 'square':
      // Volatile bond — no CE bonus, may misfire on attacks (AC-005)
      return { transitPowerBonus1: 3, transitPowerBonus2: 3, bonusCE: 0 };
    case 'sextile':
      // Special: Cosmic Resonance grants next summon -1 CE
      return {
        transitPowerBonus1: 4,
        transitPowerBonus2: 4,
        bonusCE: 0,
        specialEffect: 'Cosmic Resonance',
      };
  }
}

/**
 * Detects aspect bonds between all non-Suppressed figures on a player's battlefield.
 * Bonds form when two figures share a planet in their natal aspects at the same aspect type.
 * Cosmos confirmation via active events can establish additional bonds.
 * Bonds activate automatically (isActive: true); Chronos interference is opt-in via player action.
 */
export function detectAspectBonds(
  figures: CardInstance[],
  cosmosSnapshot: CosmosSnapshot,
): AspectBond[] {
  const bonds: AspectBond[] = [];

  for (let i = 0; i < figures.length; i++) {
    for (let j = i + 1; j < figures.length; j++) {
      const fig1 = figures[i]!;
      const fig2 = figures[j]!;

      // Suppressed figures cannot form bonds
      if (fig1.state === 'Suppressed' || fig2.state === 'Suppressed') continue;

      // Avoid duplicate bonds for the same pair
      const alreadyBonded = bonds.some(
        (b) =>
          (b.figure1Id === fig1.figureId && b.figure2Id === fig2.figureId) ||
          (b.figure1Id === fig2.figureId && b.figure2Id === fig1.figureId),
      );
      if (alreadyBonded) continue;

      // Primary detection: shared planet across natal aspect lists with matching type
      let bondAspectType: AspectType | null = null;

      outer: for (const aspect1 of fig1.figure.natalAspects) {
        for (const aspect2 of fig2.figure.natalAspects) {
          if (
            aspect1.type === aspect2.type &&
            (aspect1.planet1 === aspect2.planet1 ||
              aspect1.planet1 === aspect2.planet2 ||
              aspect1.planet2 === aspect2.planet1 ||
              aspect1.planet2 === aspect2.planet2)
          ) {
            bondAspectType = aspect1.type;
            break outer;
          }
        }
      }

      // Cosmos confirmation: active events can forge additional bonds
      if (bondAspectType === null) {
        if (cosmosSnapshot.activeEvents.includes('Grand Confluence')) {
          bondAspectType = 'conjunction';
        } else if (
          cosmosSnapshot.activeEvents.includes('Venus Ascendant') &&
          (fig1.figure.primaryForge === 'Eros' || fig2.figure.primaryForge === 'Eros')
        ) {
          bondAspectType = 'trine';
        }
      }

      if (bondAspectType === null) continue;

      const effect = calculateBondEffect(bondAspectType);

      bonds.push({
        figure1Id: fig1.figureId,
        figure2Id: fig2.figureId,
        aspectType: bondAspectType,
        effect,
        // chronosDelayCount: tracks remaining delay turns (0 = not delayed)
        chronosDelayCount: 0,
        isActive: true,
      });
    }
  }

  return bonds;
}

/**
 * Applies active bond TP bonuses to a CardInstance, returning a new instance.
 * This is a pure calculation — it does not permanently mutate game state.
 * TransitPower is clamped to [40, 100] after bond effects are applied.
 */
export function applyBondEffects(card: CardInstance, bonds: AspectBond[]): CardInstance {
  let bonusTP = 0;

  for (const bond of bonds) {
    if (!bond.isActive) continue;

    if (bond.figure1Id === card.figureId) {
      bonusTP += bond.effect.transitPowerBonus1;
    } else if (bond.figure2Id === card.figureId) {
      bonusTP += bond.effect.transitPowerBonus2;
    }
  }

  const newTP = Math.min(
    TRANSIT_POWER_CEILING,
    Math.max(TRANSIT_POWER_FLOOR, card.transitPower + bonusTP),
  );

  return {
    ...card,
    transitPower: newTP,
    activeAspectBonds: bonds.filter(
      (b) => b.figure1Id === card.figureId || b.figure2Id === card.figureId,
    ),
  };
}
