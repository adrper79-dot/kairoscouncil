/**
 * Shared test fixtures for game-engine unit tests.
 * Builds minimal valid objects that satisfy the full type contracts.
 */
import type {
  CardInstance,
  CosmosSnapshot,
  Deck,
  HistoricalFigure,
  ForgeIntensityData,
} from '@kairos/shared';

/** Minimal HistoricalFigure fixture. */
export function makeFigure(
  overrides: Partial<HistoricalFigure> = {},
): HistoricalFigure {
  return {
    id: 'test-figure',
    name: 'Test Figure',
    birthDate: new Date('100 AD'),
    birthDatePrecision: 'estimated',
    birthTimeKnown: false,
    archetypeSchool: 'Warrior',
    primaryForge: 'Chronos',
    rulingPlanet: 'Mars',
    natalAspects: [],
    era: '100 AD',
    ...overrides,
  };
}

/** Minimal ForgeIntensityData fixture. */
export function makeForgeIntensity(primary: 1 | 2 | 3 = 1): ForgeIntensityData {
  return { primary, secondary: null };
}

/** Minimal CardInstance fixture. */
export function makeCard(overrides: Partial<CardInstance> = {}): CardInstance {
  const figureId = overrides.figureId ?? 'test-figure';
  return {
    figureId,
    figure: makeFigure({ id: figureId }),
    transitPower: 60,
    state: 'Ascendant',
    forgeIntensity: makeForgeIntensity(),
    activeAspectBonds: [],
    phoenixRebornTurns: 0,
    dormantActionUsed: false,
    ...overrides,
  };
}

/** Minimal CosmosSnapshot fixture. */
export function makeCosmosSnapshot(
  overrides: Partial<CosmosSnapshot> = {},
): CosmosSnapshot {
  return {
    timestamp: new Date('2025-01-01T00:00:00Z'),
    activeEvents: [],
    forecast: [],
    ...overrides,
  };
}

/** Minimal Deck fixture with N card IDs. */
export function makeDeck(
  id: string,
  ownerId: string,
  cardIds: string[] = Array.from({ length: 20 }, (_, i) => `card-${i}`),
): Deck {
  return {
    id,
    ownerId,
    name: `Deck ${id}`,
    archetypeSchool: 'Warrior',
    cardIds,
    councilLeaderId: 'julius-caesar',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };
}
