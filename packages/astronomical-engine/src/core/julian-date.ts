/**
 * @module @kairos/astronomical-engine/core/julian-date
 * Julian Day Number calculation from calendar dates.
 * Implements Meeus "Astronomical Algorithms" Chapter 7.
 * Handles both Gregorian and Julian calendar systems.
 * AC-001: Core Layer — pure calculation, no game concepts.
 */

import { GREGORIAN_REFORM_JDE } from './constants.js';

/**
 * Converts a calendar date to Julian Ephemeris Date (JDE).
 * Handles both Gregorian and Julian calendar systems.
 *
 * @param year - Astronomical year (1 BC = 0, 2 BC = -1, etc.)
 * @param month - Month number (1–12)
 * @param day - Day number, may include fractional day (e.g., 1.5 = noon on day 1)
 * @param isGregorian - true for Gregorian calendar, false for Julian
 * @returns Julian Ephemeris Date
 *
 * @example
 * // J2000.0 epoch
 * const jde = dateToJDE(2000, 1, 1.5, true); // → 2451545.0
 *
 * @see {@link https://en.wikipedia.org/wiki/Julian_day} Meeus Chapter 7
 */
export function dateToJDE(
  year: number,
  month: number,
  day: number,
  isGregorian: boolean,
): number {
  let Y = year;
  let M = month;

  // January and February are treated as months 13 and 14 of the previous year
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  let B = 0;
  if (isGregorian) {
    const A = Math.floor(Y / 100);
    B = 2 - A + Math.floor(A / 4);
  }
  // For Julian calendar, B = 0

  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day +
    B -
    1524.5
  );
}

/**
 * Converts a Julian Ephemeris Date to calendar date components.
 * Returns Gregorian date for JDE >= GREGORIAN_REFORM_JDE, Julian otherwise.
 *
 * @param jde - Julian Ephemeris Date
 * @returns Calendar date components
 *
 * @example
 * const { year, month, day } = jdeToDate(2451545.0);
 * // { year: 2000, month: 1, day: 1.5 }
 */
export function jdeToDate(jde: number): {
  year: number;
  month: number;
  day: number;
  isGregorian: boolean;
} {
  const jd = jde + 0.5;
  const Z = Math.floor(jd);
  const F = jd - Z;

  let A: number;
  const isGregorian = Z >= GREGORIAN_REFORM_JDE + 0.5;

  if (isGregorian) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  } else {
    A = Z;
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  return { year, month, day, isGregorian };
}

/**
 * Converts a JavaScript Date object to Julian Ephemeris Date.
 * Uses Gregorian calendar (valid for dates after 1582).
 * For pre-1582 dates, use dateToJDE directly with isGregorian=false.
 *
 * @param date - JavaScript Date object
 * @returns Julian Ephemeris Date
 */
export function jsDateToJDE(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  return dateToJDE(year, month, day, true);
}

/**
 * Computes Julian centuries from J2000.0.
 * Used throughout Meeus algorithms as the time parameter T.
 *
 * @param jde - Julian Ephemeris Date
 * @returns T in Julian centuries from J2000.0
 *
 * @example
 * julianCenturies(2451545.0) // → 0.0
 * julianCenturies(2488070.0) // → ~1.0 (year 2100)
 */
export function julianCenturies(jde: number): number {
  return (jde - 2451545.0) / 36525;
}
