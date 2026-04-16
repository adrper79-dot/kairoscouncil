import { describe, it, expect } from 'vitest';
import {
  BURST_DEFINITIONS,
  canTriggerBurst,
  evaluateBursts,
} from '../../src/bursts/index.js';
import { makeCard, makeCosmosSnapshot, makeFigure } from './fixtures.js';
import type { CardInstance } from '@kairos/shared';

/** Create a card representing Julius Caesar (Silent Authority burst). */
function makeCaesar(): CardInstance {
  return makeCard({
    figureId: 'julius-caesar',
    figure: makeFigure({
      id: 'julius-caesar',
      name: 'Julius Caesar',
      primaryForge: 'Lux',
    }),
    state: 'Ascendant',
  });
}

/** Create a card representing Napoleon Bonaparte (Eternal March burst). */
function makeNapoleon(): CardInstance {
  return makeCard({
    figureId: 'napoleon-bonaparte',
    figure: makeFigure({
      id: 'napoleon-bonaparte',
      name: 'Napoleon Bonaparte',
      primaryForge: 'Phoenix',
    }),
    state: 'Ascendant',
  });
}

describe('BURST_DEFINITIONS', () => {
  it('Has 9 burst definitions for Phase 0 roster', () => {
    expect(BURST_DEFINITIONS).toHaveLength(9);
  });

  it('Each burst has a name, requiredFigureId, requiredEvent, requiredForge, effect', () => {
    for (const burst of BURST_DEFINITIONS) {
      expect(burst.name).toBeTruthy();
      expect(burst.requiredFigureId).toBeTruthy();
      expect(burst.requiredEvent).toBeTruthy();
      expect(burst.requiredForge).toBeTruthy();
      expect(burst.effect).toBeTruthy();
    }
  });

  it('Julius Caesar has Silent Authority burst with Grand Confluence requirement', () => {
    const burst = BURST_DEFINITIONS.find((b) => b.requiredFigureId === 'julius-caesar');
    expect(burst).toBeDefined();
    expect(burst?.name).toBe('Silent Authority');
    expect(burst?.requiredEvent).toBe('Grand Confluence');
    expect(burst?.requiredForge).toBe('Lux');
  });

  it('Sappho and Rumi share "The Burning Word" burst', () => {
    const burning = BURST_DEFINITIONS.filter((b) => b.name === 'The Burning Word');
    expect(burning).toHaveLength(2);
    const figureIds = burning.map((b) => b.requiredFigureId);
    expect(figureIds).toContain('sappho');
    expect(figureIds).toContain('rumi');
  });
});

describe('canTriggerBurst', () => {
  it('Returns true when figure is Ascendant, event is active, forge matches', () => {
    const caesar = makeCaesar();
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    expect(canTriggerBurst(caesar, cosmos)).toBe(true);
  });

  it('Returns false when figure is not Ascendant', () => {
    const caesar = { ...makeCaesar(), state: 'Dormant' as const };
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    expect(canTriggerBurst(caesar, cosmos)).toBe(false);
  });

  it('Returns false when required event is not active', () => {
    const caesar = makeCaesar();
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Crimson Alignment'] });
    expect(canTriggerBurst(caesar, cosmos)).toBe(false);
  });

  it('Returns false for a figure with no burst definition', () => {
    const unknown = makeCard({
      figureId: 'unknown-figure',
      figure: makeFigure({ id: 'unknown-figure', primaryForge: 'Lux' }),
      state: 'Ascendant',
    });
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    expect(canTriggerBurst(unknown, cosmos)).toBe(false);
  });

  it('Napoleon: returns true with Crimson Alignment and Phoenix forge', () => {
    const napoleon = makeNapoleon();
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Crimson Alignment'] });
    expect(canTriggerBurst(napoleon, cosmos)).toBe(true);
  });

  it('Napoleon: returns false with wrong event', () => {
    const napoleon = makeNapoleon();
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    expect(canTriggerBurst(napoleon, cosmos)).toBe(false);
  });
});

describe('evaluateBursts', () => {
  it('Returns empty array for empty battlefield', () => {
    expect(evaluateBursts([], makeCosmosSnapshot())).toEqual([]);
  });

  it('Returns empty array for figures with no burst definition', () => {
    const unknown = makeCard({ figureId: 'unknown' });
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    expect(evaluateBursts([unknown], cosmos)).toEqual([]);
  });

  it('Returns result entry for Caesar with isAvailable=true when conditions met', () => {
    const caesar = makeCaesar();
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    const results = evaluateBursts([caesar], cosmos);
    expect(results).toHaveLength(1);
    expect(results[0]?.figureId).toBe('julius-caesar');
    expect(results[0]?.burstName).toBe('Silent Authority');
    expect(results[0]?.isAvailable).toBe(true);
  });

  it('Returns result entry for Caesar with isAvailable=false when event not active', () => {
    const caesar = makeCaesar();
    const cosmos = makeCosmosSnapshot({ activeEvents: [] });
    const results = evaluateBursts([caesar], cosmos);
    expect(results).toHaveLength(1);
    expect(results[0]?.isAvailable).toBe(false);
  });

  it('Evaluates multiple figures independently', () => {
    const caesar = makeCaesar();
    const napoleon = makeNapoleon();
    const cosmos = makeCosmosSnapshot({
      activeEvents: ['Grand Confluence', 'Crimson Alignment'],
    });
    const results = evaluateBursts([caesar, napoleon], cosmos);
    expect(results).toHaveLength(2);
    const caesarResult = results.find((r) => r.figureId === 'julius-caesar');
    const napoleonResult = results.find((r) => r.figureId === 'napoleon-bonaparte');
    expect(caesarResult?.isAvailable).toBe(true);
    expect(napoleonResult?.isAvailable).toBe(true);
  });
});
