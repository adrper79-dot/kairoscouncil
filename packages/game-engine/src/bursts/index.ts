/**
 * @module @kairos/game-engine/bursts
 * Burst trigger evaluation for the 6 defined Bursts.
 * Trigger: named figure Ascendant + compatible event + figure's primary Forge.
 */

import type {
  CardInstance,
  CosmosSnapshot,
  BurstDefinition,
  CelestialEventName,
  ForgeSchool,
} from '@kairos/shared';

/** Result of evaluating burst conditions for a single figure. */
export interface BurstTriggerResult {
  figureId: string;
  burstName: string;
  effect: string;
  isAvailable: boolean;
}

/**
 * Phase 0 Roster burst definitions.
 * Trigger conditions: figure Ascendant + requiredEvent active + figure's primaryForge matches.
 */
export const BURST_DEFINITIONS: BurstDefinition[] = [
  {
    name: 'Silent Authority',
    requiredFigureId: 'julius-caesar',
    requiredEvent: 'Grand Confluence' satisfies CelestialEventName,
    requiredForge: 'Lux' satisfies ForgeSchool,
    effect:
      'All opponent figures lose their active aspect bonds until end of next turn. Clock display distortion extends to ±2 for all Lux viewers.',
  },
  {
    name: 'Eternal March',
    requiredFigureId: 'napoleon-bonaparte',
    requiredEvent: 'Crimson Alignment' satisfies CelestialEventName,
    requiredForge: 'Phoenix' satisfies ForgeSchool,
    effect:
      'Deal double damage to all Dormant and Suppressed opponent figures this turn. Phoenix Forge intensity treated as 3 for this attack.',
  },
  {
    name: 'Court of Desire',
    requiredFigureId: 'cleopatra-vii',
    requiredEvent: 'Venus Ascendant' satisfies CelestialEventName,
    requiredForge: 'Eros' satisfies ForgeSchool,
    effect:
      "Charm the opponent's highest-TP figure: it is removed from their battlefield and placed in a neutral zone for 2 turns, unable to attack or be targeted.",
  },
  {
    name: 'Harmonic Proof',
    requiredFigureId: 'pythagoras',
    requiredEvent: 'Mercury Fracture' satisfies CelestialEventName,
    requiredForge: 'Aether' satisfies ForgeSchool,
    effect:
      'Reveal all forecast entries for the next 3 turns. All friendly Aether figures gain +10 TP until end of next turn.',
  },
  {
    name: 'The Burning Word',
    requiredFigureId: 'sappho',
    requiredEvent: 'Venus Ascendant' satisfies CelestialEventName,
    requiredForge: 'Eros' satisfies ForgeSchool,
    additionalConditions: 'Eros forge',
    effect:
      'All friendly Eros forge figures gain +15 TP for 2 turns. Any new Eros figure summoned this turn costs 0 CE.',
  },
  {
    name: 'Logos Barrier',
    requiredFigureId: 'hypatia',
    requiredEvent: 'Mercury Fracture' satisfies CelestialEventName,
    requiredForge: 'Aether' satisfies ForgeSchool,
    effect:
      'All incoming damage to friendly figures is halved for 1 full round. Dormant friendly figures may take one action this turn without spending CE.',
  },
  {
    name: 'The Burning Word',
    requiredFigureId: 'rumi',
    requiredEvent: 'Venus Ascendant' satisfies CelestialEventName,
    requiredForge: 'Eros' satisfies ForgeSchool,
    additionalConditions: 'Eros forge',
    effect:
      'All friendly Eros forge figures gain +15 TP for 2 turns. Any new Eros figure summoned this turn costs 0 CE.',
  },
  {
    name: 'Empty Fortress',
    requiredFigureId: 'sun-tzu',
    requiredEvent: 'Silent Eclipse' satisfies CelestialEventName,
    requiredForge: 'Lux' satisfies ForgeSchool,
    effect:
      'Sun Tzu becomes untargetable for 1 full round while retaining full attack capability. Opponent cannot see Sun Tzu TP value during this period.',
  },
  {
    name: 'Green World',
    requiredFigureId: 'hildegard-von-bingen',
    requiredEvent: 'Jupiter Ascension' satisfies CelestialEventName,
    requiredForge: 'Eros' satisfies ForgeSchool,
    effect:
      'Restore up to 2 friendly Dormant figures to Ascendant status. Each restored figure gains +5 TP for 1 turn.',
  },
];

/**
 * Checks whether a burst can be triggered for the given card in the current cosmos state.
 * Requirements: figure is Ascendant + required celestial event is active + primary forge matches.
 */
export function canTriggerBurst(card: CardInstance, cosmosSnapshot: CosmosSnapshot): boolean {
  const burst = BURST_DEFINITIONS.find((b) => b.requiredFigureId === card.figure.id);
  if (!burst) return false;

  return (
    card.state === 'Ascendant' &&
    cosmosSnapshot.activeEvents.includes(burst.requiredEvent) &&
    card.figure.primaryForge === burst.requiredForge
  );
}

/**
 * Evaluates burst conditions for all figures on the battlefield.
 * Returns a result entry only for figures that have a burst definition.
 */
export function evaluateBursts(
  battlefield: CardInstance[],
  cosmosSnapshot: CosmosSnapshot,
): BurstTriggerResult[] {
  const results: BurstTriggerResult[] = [];

  for (const card of battlefield) {
    const burst = BURST_DEFINITIONS.find((b) => b.requiredFigureId === card.figure.id);
    if (!burst) continue;

    results.push({
      figureId: card.figureId,
      burstName: burst.name,
      effect: burst.effect,
      isAvailable: canTriggerBurst(card, cosmosSnapshot),
    });
  }

  return results;
}
