/**
 * @module @kairos/astronomical-engine/core/natal-chart
 * Computes natal charts from birth data.
 * A natal chart is a snapshot of planetary positions at birth time.
 * AC-001: Core Layer — no game concepts.
 */

import type { NatalChart, BirthData } from '@kairos/shared';
import { calculatePlanetaryPositions } from './planetary-positions.js';
import { detectAspects } from './aspects.js';

/** Input for natal chart computation. JDE is preferred over Date for accuracy. */
export interface NatalChartInput {
  jde: number;
  timeKnown: boolean;
  latitude?: number;
  longitude?: number;
}

/**
 * Computes a natal chart from a Julian Date.
 * If timeKnown is false, the JDE should be pre-set to noon on the birth date
 * to minimize positional error for unknown birth times.
 *
 * @param input - Birth JDE and time precision flag
 * @returns Computed NatalChart with planetary positions and natal aspects
 *
 * @example
 * const napoleonJDE = dateToJDE(1769, 8, 15, true); // Gregorian
 * const chart = computeNatalChart({ jde: napoleonJDE, timeKnown: false });
 * // chart.planetaryPositions[0].planet === 'Sun'
 * // chart.planetaryPositions[0].sign === 'Leo'
 *
 * @see AC-001 — output feeds CosmosState for transit detection
 */
export function computeNatalChart(input: NatalChartInput): NatalChart {
  const { jde, timeKnown, latitude, longitude } = input;

  const positions = calculatePlanetaryPositions(jde);
  const aspects = detectAspects(positions);

  // Construct a BirthData from the JDE (approximate Date for storage)
  const msFromEpoch = (jde - 2440587.5) * 86400000;
  const birthData: BirthData = {
    date: new Date(msFromEpoch),
    timeKnown,
    latitude,
    longitude,
  };

  return {
    birthData,
    julianDate: jde,
    planetaryPositions: positions,
    natalAspects: aspects,
  };
}

/**
 * Computes a natal chart from a BirthData object (contains a JS Date).
 * Converts the Date to JDE internally.
 * For pre-Gregorian dates, use computeNatalChart with a precomputed JDE.
 *
 * @param birthData - Birth data with Date, location, time precision
 * @returns Computed NatalChart
 */
export function computeNatalChartFromBirthData(birthData: BirthData): NatalChart {
  const d = birthData.date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  // Use noon if time not known
  const day = birthData.timeKnown
    ? d.getUTCDate() + d.getUTCHours() / 24 + d.getUTCMinutes() / 1440
    : d.getUTCDate() + 0.5;

  // Determine calendar: Gregorian if >= 15 Oct 1582
  const isGregorian =
    year > 1582 ||
    (year === 1582 && month > 10) ||
    (year === 1582 && month === 10 && d.getUTCDate() >= 15);

  // Inline JDE calculation to avoid circular import
  let Y = year;
  let M = month;
  if (M <= 2) { Y -= 1; M += 12; }
  let B = 0;
  if (isGregorian) {
    const A = Math.floor(Y / 100);
    B = 2 - A + Math.floor(A / 4);
  }
  const jde = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + day + B - 1524.5;

  const positions = calculatePlanetaryPositions(jde);
  const aspects = detectAspects(positions);

  return {
    birthData,
    julianDate: jde,
    planetaryPositions: positions,
    natalAspects: aspects,
  };
}

