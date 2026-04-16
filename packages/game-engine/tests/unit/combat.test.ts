import { describe, it, expect } from 'vitest';
import {
  resolveAttack,
  applyDamage,
  getForgeMatchup,
} from '../../src/combat/index.js';
import { SeededRandom } from '../../src/seed/index.js';
import { makeCard, makeCosmosSnapshot, makeFigure } from './fixtures.js';
import type { CardInstance } from '@kairos/shared';

const RNG = new SeededRandom(42);

function makeAttacker(tp: number, forge: CardInstance['figure']['primaryForge'] = 'Chronos'): CardInstance {
  return makeCard({
    figureId: 'attacker',
    figure: makeFigure({ id: 'attacker', primaryForge: forge }),
    transitPower: tp,
    forgeIntensity: { primary: 1, secondary: null },
    state: 'Ascendant',
  });
}

function makeTarget(tp: number, forge: CardInstance['figure']['primaryForge'] = 'Chronos'): CardInstance {
  return makeCard({
    figureId: 'target',
    figure: makeFigure({ id: 'target', primaryForge: forge }),
    transitPower: tp,
    state: 'Ascendant',
  });
}

describe('getForgeMatchup (AC-006)', () => {
  it('Lux vs Chronos → strong', () => {
    expect(getForgeMatchup('Lux', 'Chronos')).toBe('strong');
  });

  it('Chronos vs Lux → weak', () => {
    expect(getForgeMatchup('Chronos', 'Lux')).toBe('weak');
  });

  it('Phoenix vs Eros → strong', () => {
    expect(getForgeMatchup('Phoenix', 'Eros')).toBe('strong');
  });

  it('Eros vs Aether → strong', () => {
    expect(getForgeMatchup('Eros', 'Aether')).toBe('strong');
  });

  it('Aether vs Eros → weak', () => {
    expect(getForgeMatchup('Aether', 'Eros')).toBe('weak');
  });

  it('Self-matchup is always neutral', () => {
    const forges = ['Chronos', 'Eros', 'Aether', 'Lux', 'Phoenix'] as const;
    for (const f of forges) {
      expect(getForgeMatchup(f, f)).toBe('neutral');
    }
  });
});

describe('resolveAttack (AC-005)', () => {
  it('Damage = floor(TP × FI × matchup_modifier)', () => {
    const attacker = makeAttacker(60, 'Lux');   // Lux vs Chronos = strong (1.1×)
    const target = makeTarget(50, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    // FI=1, matchup=1.1 → 60×1×1.1 = 66
    expect(result.damage).toBe(66);
  });

  it('Neutral matchup: damage = TP × FI', () => {
    const attacker = makeAttacker(60, 'Chronos');
    const target = makeTarget(50, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.damage).toBe(60); // 60×1×1.0
  });

  it('Weak matchup reduces damage', () => {
    const attacker = makeAttacker(60, 'Chronos'); // Chronos vs Lux = weak (0.9×)
    const target = makeTarget(50, 'Lux');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.damage).toBe(54); // 60×1×0.9
  });

  it('Forge Intensity 2 doubles damage vs FI=1', () => {
    const attacker = makeCard({
      figureId: 'a',
      figure: makeFigure({ id: 'a', primaryForge: 'Chronos' }),
      transitPower: 60,
      forgeIntensity: { primary: 2, secondary: null },
      state: 'Ascendant',
    });
    const target = makeTarget(50, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.damage).toBe(120); // 60×2×1.0
  });

  it('Clamps TP below floor (40) to 40', () => {
    const attacker = makeAttacker(20, 'Chronos'); // TP=20 → clamped to 40
    const target = makeTarget(50, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.transitPower).toBe(40);
    expect(result.damage).toBe(40); // 40×1×1.0
  });

  it('Clamps TP above ceiling (100) to 100', () => {
    const attacker = makeAttacker(150, 'Chronos'); // TP=150 → clamped to 100
    const target = makeTarget(50, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.transitPower).toBe(100);
  });

  it('targetSuppressed is true when damage >= target TP', () => {
    const attacker = makeAttacker(70, 'Lux');  // 70×1×1.1=77
    const target = makeTarget(70, 'Chronos');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.targetSuppressed).toBe(result.damage >= 70);
  });

  it('Result includes forgeMatchup info', () => {
    const attacker = makeAttacker(60, 'Eros');
    const target = makeTarget(50, 'Aether');
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.forgeMatchup).toBe('strong');
    expect(result.matchupModifier).toBeCloseTo(1.1, 5);
  });

  it('squareMisfired is false when no square bond with target', () => {
    const attacker = makeAttacker(60);
    const target = makeTarget(50);
    const result = resolveAttack(attacker, target, makeCosmosSnapshot(), new SeededRandom(1));
    expect(result.squareMisfired).toBe(false);
  });
});

describe('applyDamage (AC-005)', () => {
  it('damage >= TP → Suppressed', () => {
    const target = makeTarget(60);
    const result = { damage: 60, transitPower: 60, forgeIntensity: 1 as const, forgeMatchup: 'neutral' as const, matchupModifier: 1, targetSuppressed: true, squareMisfired: false, misfireTargetId: undefined };
    const updated = applyDamage(target, result);
    expect(updated.state).toBe('Suppressed');
  });

  it('damage >= TP * 0.5 but < TP → Dormant', () => {
    const target = makeTarget(60);
    const result = { damage: 40, transitPower: 60, forgeIntensity: 1 as const, forgeMatchup: 'neutral' as const, matchupModifier: 1, targetSuppressed: false, squareMisfired: false, misfireTargetId: undefined };
    const updated = applyDamage(target, result);
    expect(updated.state).toBe('Dormant');
  });

  it('damage < TP * 0.5 → no state change', () => {
    const target = makeTarget(60);
    const result = { damage: 20, transitPower: 60, forgeIntensity: 1 as const, forgeMatchup: 'neutral' as const, matchupModifier: 1, targetSuppressed: false, squareMisfired: false, misfireTargetId: undefined };
    const updated = applyDamage(target, result);
    expect(updated.state).toBe('Ascendant');
  });

  it('applyDamage does not mutate the original CardInstance', () => {
    const target = makeTarget(60);
    const original = { ...target };
    const result = { damage: 60, transitPower: 60, forgeIntensity: 1 as const, forgeMatchup: 'neutral' as const, matchupModifier: 1, targetSuppressed: true, squareMisfired: false, misfireTargetId: undefined };
    applyDamage(target, result);
    expect(target.state).toBe(original.state);
  });
});
