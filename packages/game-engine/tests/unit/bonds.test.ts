import { describe, it, expect } from 'vitest';
import {
  calculateBondEffect,
  detectAspectBonds,
  applyBondEffects,
} from '../../src/bonds/index.js';
import { makeCard, makeCosmosSnapshot, makeFigure } from './fixtures.js';
import type { CardInstance } from '@kairos/shared';

/** Create a card with a specific natal aspect to enable bond detection. */
function makeCardWithAspect(id: string, planet1: 'Sun', planet2: 'Mars', type: 'trine'): CardInstance;
function makeCardWithAspect(id: string, planet1: string, planet2: string, type: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile'): CardInstance {
  return makeCard({
    figureId: id,
    figure: makeFigure({
      id,
      natalAspects: [{ planet1: planet1 as 'Sun', planet2: planet2 as 'Mars', type, orb: 1 }],
    }),
  });
}

describe('calculateBondEffect', () => {
  it('Conjunction: TP +8 each, CE +2', () => {
    const effect = calculateBondEffect('conjunction');
    expect(effect.transitPowerBonus1).toBe(8);
    expect(effect.transitPowerBonus2).toBe(8);
    expect(effect.bonusCE).toBe(2);
  });

  it('Opposition: TP +5 each, CE +1', () => {
    const effect = calculateBondEffect('opposition');
    expect(effect.transitPowerBonus1).toBe(5);
    expect(effect.transitPowerBonus2).toBe(5);
    expect(effect.bonusCE).toBe(1);
  });

  it('Trine: TP +6 each, CE +1', () => {
    const effect = calculateBondEffect('trine');
    expect(effect.transitPowerBonus1).toBe(6);
    expect(effect.transitPowerBonus2).toBe(6);
    expect(effect.bonusCE).toBe(1);
  });

  it('Square (volatile): TP +3 each, CE 0', () => {
    const effect = calculateBondEffect('square');
    expect(effect.transitPowerBonus1).toBe(3);
    expect(effect.transitPowerBonus2).toBe(3);
    expect(effect.bonusCE).toBe(0);
  });

  it('Sextile (Cosmic Resonance): TP +4 each, CE 0, specialEffect set', () => {
    const effect = calculateBondEffect('sextile');
    expect(effect.transitPowerBonus1).toBe(4);
    expect(effect.transitPowerBonus2).toBe(4);
    expect(effect.bonusCE).toBe(0);
    expect(effect.specialEffect).toBe('Cosmic Resonance');
  });

  it('Bond effects are symmetric (bonus1 === bonus2)', () => {
    const types = ['conjunction', 'opposition', 'trine', 'square', 'sextile'] as const;
    for (const type of types) {
      const effect = calculateBondEffect(type);
      expect(effect.transitPowerBonus1).toBe(effect.transitPowerBonus2);
    }
  });
});

describe('detectAspectBonds', () => {
  it('Returns empty array for empty battlefield', () => {
    expect(detectAspectBonds([], makeCosmosSnapshot())).toEqual([]);
  });

  it('Returns empty array for single figure (no pairs)', () => {
    const card = makeCard();
    expect(detectAspectBonds([card], makeCosmosSnapshot())).toHaveLength(0);
  });

  it('Detects bond between two figures sharing a natal aspect type and planet', () => {
    const card1 = makeCardWithAspect('fig1', 'Sun', 'Mars', 'trine');
    const card2 = makeCardWithAspect('fig2', 'Sun', 'Moon', 'trine');
    // Both share Sun + trine aspect type
    const bonds = detectAspectBonds([card1, card2], makeCosmosSnapshot());
    expect(bonds).toHaveLength(1);
    expect(bonds[0]?.aspectType).toBe('trine');
  });

  it('Suppressed figures do not form bonds', () => {
    const card1 = makeCardWithAspect('fig1', 'Sun', 'Mars', 'trine');
    const card2 = makeCardWithAspect('fig2', 'Sun', 'Moon', 'trine');
    const suppressed = { ...card1, state: 'Suppressed' as const };
    const bonds = detectAspectBonds([suppressed, card2], makeCosmosSnapshot());
    expect(bonds).toHaveLength(0);
  });

  it('Grand Confluence event creates a conjunction bond between any pair', () => {
    // No shared natal aspects
    const card1 = makeCard({ figureId: 'fig1' });
    const card2 = makeCard({ figureId: 'fig2' });
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Grand Confluence'] });
    const bonds = detectAspectBonds([card1, card2], cosmos);
    expect(bonds).toHaveLength(1);
    expect(bonds[0]?.aspectType).toBe('conjunction');
  });

  it('Venus Ascendant creates trine bond for Eros forge pairs', () => {
    const card1 = makeCard({
      figureId: 'fig1',
      figure: makeFigure({ id: 'fig1', primaryForge: 'Eros' }),
    });
    const card2 = makeCard({
      figureId: 'fig2',
      figure: makeFigure({ id: 'fig2', primaryForge: 'Chronos' }),
    });
    const cosmos = makeCosmosSnapshot({ activeEvents: ['Venus Ascendant'] });
    const bonds = detectAspectBonds([card1, card2], cosmos);
    expect(bonds).toHaveLength(1);
    expect(bonds[0]?.aspectType).toBe('trine');
  });

  it('No duplicate bonds for the same pair', () => {
    const card1 = makeCardWithAspect('fig1', 'Sun', 'Mars', 'trine');
    const card2 = makeCardWithAspect('fig2', 'Sun', 'Moon', 'trine');
    const bonds = detectAspectBonds([card1, card2], makeCosmosSnapshot());
    expect(bonds).toHaveLength(1);
  });

  it('Bonds are automatically active', () => {
    const card1 = makeCardWithAspect('fig1', 'Sun', 'Mars', 'trine');
    const card2 = makeCardWithAspect('fig2', 'Sun', 'Moon', 'trine');
    const bonds = detectAspectBonds([card1, card2], makeCosmosSnapshot());
    expect(bonds[0]?.isActive).toBe(true);
  });
});

describe('applyBondEffects', () => {
  it('No bonds → TP unchanged', () => {
    const card = makeCard({ transitPower: 60 });
    const result = applyBondEffects(card, []);
    expect(result.transitPower).toBe(60);
  });

  it('Active trine bond adds +6 TP', () => {
    const card = makeCard({ figureId: 'fig1', transitPower: 60 });
    const bond = {
      figure1Id: 'fig1',
      figure2Id: 'fig2',
      aspectType: 'trine' as const,
      effect: calculateBondEffect('trine'),
      chronosDelayCount: 0,
      isActive: true,
    };
    const result = applyBondEffects(card, [bond]);
    expect(result.transitPower).toBe(66);
  });

  it('Inactive bond does not add TP', () => {
    const card = makeCard({ figureId: 'fig1', transitPower: 60 });
    const bond = {
      figure1Id: 'fig1',
      figure2Id: 'fig2',
      aspectType: 'trine' as const,
      effect: calculateBondEffect('trine'),
      chronosDelayCount: 0,
      isActive: false,
    };
    const result = applyBondEffects(card, [bond]);
    expect(result.transitPower).toBe(60);
  });

  it('TP is clamped to 100 ceiling after bond bonus', () => {
    const card = makeCard({ figureId: 'fig1', transitPower: 98 });
    const bond = {
      figure1Id: 'fig1',
      figure2Id: 'fig2',
      aspectType: 'conjunction' as const,
      effect: calculateBondEffect('conjunction'),
      chronosDelayCount: 0,
      isActive: true,
    };
    const result = applyBondEffects(card, [bond]);
    expect(result.transitPower).toBe(100);
  });

  it('applyBondEffects does not mutate the original card', () => {
    const card = makeCard({ figureId: 'fig1', transitPower: 60 });
    const bond = {
      figure1Id: 'fig1',
      figure2Id: 'fig2',
      aspectType: 'trine' as const,
      effect: calculateBondEffect('trine'),
      chronosDelayCount: 0,
      isActive: true,
    };
    applyBondEffects(card, [bond]);
    expect(card.transitPower).toBe(60);
  });
});
