import { describe, it, expect } from 'vitest';
import {
  TRANSIT_POWER_FLOOR,
  TRANSIT_POWER_CEILING,
  ASCENDANT_THRESHOLD,
  ASPECT_WEIGHTS,
  MAX_ASPECT_ORB,
  MAX_EXACTNESS_SCORE,
  DIGNITY_BONUS,
  FORGE_MATRIX,
  BASE_CE_PER_TURN,
  MAX_CE_CARRYOVER,
  MAX_CE,
  CHRONOS_DELAY_COST,
  LUX_TP_DISTORTION_RANGE,
  LUX_CLOCK_DISTORTION_RANGE,
  TRANSIT_CACHE_REFRESH_HOURS,
  TRANSIT_CLOCK_WIN,
  ECLIPSE_HARMONIC_WIN,
  OPENING_HAND_SIZE,
  FORGE_MATCHUP_MODIFIERS,
  DECK_SIZE,
  MARKETPLACE_TAX_RATE,
} from '../../src/constants/index.js';

describe('Transit Power Constants (AC-004)', () => {
  it('TRANSIT_POWER_FLOOR is 40', () => {
    expect(TRANSIT_POWER_FLOOR).toBe(40);
  });

  it('TRANSIT_POWER_CEILING is 100', () => {
    expect(TRANSIT_POWER_CEILING).toBe(100);
  });

  it('ASCENDANT_THRESHOLD is 60', () => {
    expect(ASCENDANT_THRESHOLD).toBe(60);
  });

  it('floor < ascendant_threshold < ceiling', () => {
    expect(TRANSIT_POWER_FLOOR).toBeLessThan(ASCENDANT_THRESHOLD);
    expect(ASCENDANT_THRESHOLD).toBeLessThan(TRANSIT_POWER_CEILING);
  });

  it('MAX_ASPECT_ORB is 3', () => {
    expect(MAX_ASPECT_ORB).toBe(3);
  });

  it('MAX_EXACTNESS_SCORE is 10', () => {
    expect(MAX_EXACTNESS_SCORE).toBe(10);
  });

  it('Aspect weights are defined for all 5 aspect types', () => {
    expect(Object.keys(ASPECT_WEIGHTS)).toHaveLength(5);
    expect(ASPECT_WEIGHTS.conjunction).toBe(3.0);
    expect(ASPECT_WEIGHTS.opposition).toBe(2.0);
    expect(ASPECT_WEIGHTS.trine).toBe(1.8);
    expect(ASPECT_WEIGHTS.square).toBe(1.5);
    expect(ASPECT_WEIGHTS.sextile).toBe(1.2);
  });

  it('Conjunction has the highest aspect weight', () => {
    const max = Math.max(...Object.values(ASPECT_WEIGHTS));
    expect(ASPECT_WEIGHTS.conjunction).toBe(max);
  });

  it('Dignity bonuses: domicile/exaltation positive, detriment/fall negative', () => {
    expect(DIGNITY_BONUS.domicile).toBeGreaterThan(0);
    expect(DIGNITY_BONUS.exaltation).toBeGreaterThan(0);
    expect(DIGNITY_BONUS.detriment).toBeLessThan(0);
    expect(DIGNITY_BONUS.fall).toBeLessThan(0);
    expect(DIGNITY_BONUS.peregrine).toBe(0);
  });
});

describe('Attack Damage Constants (AC-005)', () => {
  it('FORGE_MATCHUP_MODIFIERS: strong > neutral > weak', () => {
    expect(FORGE_MATCHUP_MODIFIERS.strong).toBeGreaterThan(FORGE_MATCHUP_MODIFIERS.neutral);
    expect(FORGE_MATCHUP_MODIFIERS.neutral).toBeGreaterThan(FORGE_MATCHUP_MODIFIERS.weak);
  });

  it('Neutral modifier is exactly 1.0', () => {
    expect(FORGE_MATCHUP_MODIFIERS.neutral).toBe(1.0);
  });
});

describe('Forge Interaction Matrix (AC-006)', () => {
  const forges = ['Chronos', 'Eros', 'Aether', 'Lux', 'Phoenix'] as const;

  it('Matrix covers all 5×5 combinations', () => {
    for (const attacker of forges) {
      for (const defender of forges) {
        expect(FORGE_MATRIX[attacker][defender]).toMatch(/^(strong|neutral|weak)$/);
      }
    }
  });

  it('Self-matchup is always neutral', () => {
    for (const forge of forges) {
      expect(FORGE_MATRIX[forge][forge]).toBe('neutral');
    }
  });

  it('AC-006 spot checks: Lux strong vs Chronos, Phoenix strong vs Eros', () => {
    expect(FORGE_MATRIX['Lux']['Chronos']).toBe('strong');
    expect(FORGE_MATRIX['Phoenix']['Eros']).toBe('strong');
    expect(FORGE_MATRIX['Chronos']['Lux']).toBe('weak');
    expect(FORGE_MATRIX['Phoenix']['Aether']).toBe('weak');
  });

  it('Matrix is not symmetric — strong/weak pairs are mirrored', () => {
    // Lux is strong vs Chronos → Chronos should be weak vs Lux
    expect(FORGE_MATRIX['Chronos']['Lux']).toBe('weak');
    expect(FORGE_MATRIX['Eros']['Chronos']).toBe('weak');
    expect(FORGE_MATRIX['Chronos']['Phoenix']).toBe('strong');
  });
});

describe('Celestial Energy Economy (AC-007)', () => {
  it('BASE_CE_PER_TURN is 3', () => {
    expect(BASE_CE_PER_TURN).toBe(3);
  });

  it('MAX_CE is 7', () => {
    expect(MAX_CE).toBe(7);
  });

  it('MAX_CE_CARRYOVER is 1', () => {
    expect(MAX_CE_CARRYOVER).toBe(1);
  });

  it('CHRONOS_DELAY_COST is 2', () => {
    expect(CHRONOS_DELAY_COST).toBe(2);
  });
});

describe('Lux Distortion (AC-008)', () => {
  it('LUX_TP_DISTORTION_RANGE is 8', () => {
    expect(LUX_TP_DISTORTION_RANGE).toBe(8);
  });

  it('LUX_CLOCK_DISTORTION_RANGE is 1', () => {
    expect(LUX_CLOCK_DISTORTION_RANGE).toBe(1);
  });
});

describe('Transit Cache SLA (AC-009)', () => {
  it('TRANSIT_CACHE_REFRESH_HOURS is 4', () => {
    expect(TRANSIT_CACHE_REFRESH_HOURS).toBe(4);
  });
});

describe('Match Constants', () => {
  it('TRANSIT_CLOCK_WIN is 13', () => {
    expect(TRANSIT_CLOCK_WIN).toBe(13);
  });

  it('ECLIPSE_HARMONIC_WIN is 12', () => {
    expect(ECLIPSE_HARMONIC_WIN).toBe(12);
  });

  it('OPENING_HAND_SIZE is 5', () => {
    expect(OPENING_HAND_SIZE).toBe(5);
  });

  it('DECK_SIZE is 20', () => {
    expect(DECK_SIZE).toBe(20);
  });
});

describe('Economy Constants (AC-010)', () => {
  it('MARKETPLACE_TAX_RATE is 3%', () => {
    expect(MARKETPLACE_TAX_RATE).toBe(0.03);
  });
});
