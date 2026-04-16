/**
 * @module @kairos/astronomical-engine/core/dignity
 * Evaluates classical planetary dignity (domicile, exaltation, detriment, fall, peregrine).
 * Based on traditional Western astrology dignities (Ptolemaic system).
 * Includes modern rulerships for Uranus, Neptune, Pluto.
 * AC-001: Core Layer — output is DignityState, consumed by Event Mapper.
 */

import type { DignityState } from '@kairos/shared';
import { normalize360 } from './math-utils.js';

/**
 * Returns the zodiac sign index (0–11) for a given ecliptic longitude.
 * Aries=0, Taurus=1, Gemini=2, …, Pisces=11
 */
function signIndex(longitude: number): number {
  return Math.floor(normalize360(longitude) / 30);
}

/**
 * Dignity table per planet.
 * Each entry lists sign indices for each dignity level.
 * Signs: 0=Aries 1=Taurus 2=Gemini 3=Cancer 4=Leo 5=Virgo
 *        6=Libra 7=Scorpio 8=Sag 9=Cap 10=Aqu 11=Pisces
 */
const DIGNITY_TABLE: Record<
  string,
  {
    domicile: number[];
    exaltation: number[];
    detriment: number[];
    fall: number[];
  }
> = {
  Sun: {
    domicile: [4],           // Leo
    exaltation: [0],         // Aries
    detriment: [10],         // Aquarius
    fall: [6],               // Libra
  },
  Moon: {
    domicile: [3],           // Cancer
    exaltation: [1],         // Taurus
    detriment: [9],          // Capricorn
    fall: [7],               // Scorpio
  },
  Mercury: {
    domicile: [2, 5],        // Gemini, Virgo
    exaltation: [5],         // Virgo
    detriment: [8, 11],      // Sagittarius, Pisces
    fall: [11],              // Pisces (also detriment — treated as worst case)
  },
  Venus: {
    domicile: [1, 6],        // Taurus, Libra
    exaltation: [11],        // Pisces
    detriment: [0, 7],       // Aries, Scorpio
    fall: [5],               // Virgo
  },
  Mars: {
    domicile: [0, 7],        // Aries, Scorpio
    exaltation: [9],         // Capricorn
    detriment: [1, 6],       // Taurus, Libra
    fall: [3],               // Cancer
  },
  Jupiter: {
    domicile: [8, 11],       // Sagittarius, Pisces
    exaltation: [3],         // Cancer
    detriment: [2, 5],       // Gemini, Virgo
    fall: [9],               // Capricorn
  },
  Saturn: {
    domicile: [9, 10],       // Capricorn, Aquarius
    exaltation: [6],         // Libra
    detriment: [3, 4],       // Cancer, Leo
    fall: [0],               // Aries
  },
  Uranus: {
    domicile: [10],          // Aquarius (modern rulership)
    exaltation: [7],         // Scorpio (disputed, modern)
    detriment: [4],          // Leo
    fall: [1],               // Taurus
  },
  Neptune: {
    domicile: [11],          // Pisces (modern rulership)
    exaltation: [3],         // Cancer (disputed, modern) or Leo
    detriment: [5],          // Virgo
    fall: [9],               // Capricorn
  },
  Pluto: {
    domicile: [7],           // Scorpio (modern rulership)
    exaltation: [0],         // Aries (disputed, modern)
    detriment: [1],          // Taurus
    fall: [6],               // Libra
  },
};

/**
 * Evaluates the dignity of a planet at a given longitude.
 * Priority order: exaltation > domicile > fall > detriment > peregrine
 * (fall and detriment are both debilities; fall is sign-specific)
 *
 * @param planet - Planet name
 * @param longitude - Ecliptic longitude in degrees [0, 360)
 * @returns DignityState for the planet in that position
 *
 * @example
 * evaluateDignity('Sun', 125) // → 'domicile' (Leo)
 * evaluateDignity('Sun', 195) // → 'fall' (Libra)
 * evaluateDignity('Sun', 270) // → 'peregrine' (Capricorn)
 */
export function evaluateDignity(planet: string, longitude: number): DignityState {
  const table = DIGNITY_TABLE[planet];
  if (!table) return 'peregrine';

  const idx = signIndex(longitude);

  if (table.exaltation.includes(idx)) return 'exaltation';
  if (table.domicile.includes(idx)) return 'domicile';
  if (table.fall.includes(idx)) return 'fall';
  if (table.detriment.includes(idx)) return 'detriment';
  return 'peregrine';
}
