/**
 * @module @kairos/astronomical-engine/core/planetary-positions
 * Geocentric ecliptic positions for all 10 bodies (Sun–Pluto).
 * Uses: Meeus Ch.25 for Sun, simplified Ch.47 for Moon,
 *       Keplerian elements (Meeus Ch.33) for other planets.
 * Accuracy: ~0.01° for Sun, ~0.3° Moon, ~1° planets.
 * AC-001: Core Layer — no game concepts.
 */

import type { PlanetaryPosition, Planet, ZodiacSign } from '@kairos/shared';
import { julianCenturies } from './julian-date.js';
import { calculateSunLongitude } from './solar-position.js';
import { calculateMoonLongitude, calculateMoonLatitude } from './lunar-position.js';
import { evaluateDignity } from './dignity.js';
import {
  normalize360,
  toRadians,
  toDegrees,
  solveKepler,
  trueAnomaly,
  longitudeToSign,
  longitudeToSignDegree,
} from './math-utils.js';
import { ORBITAL_ELEMENTS } from './constants.js';

/**
 * Computes heliocentric rectangular ecliptic coordinates (x, y, z in AU)
 * for a planet given its Keplerian orbital elements at time T.
 *
 * @param planetName - Name of the planet (key in ORBITAL_ELEMENTS)
 * @param T - Julian centuries from J2000.0
 * @returns Heliocentric rectangular coordinates {x, y, z}
 */
function heliocentricCoordinates(
  planetName: string,
  T: number,
): { x: number; y: number; z: number } {
  const el = ORBITAL_ELEMENTS[planetName];
  if (!el) throw new Error(`Unknown planet: ${planetName}`);

  // Orbital elements at time T
  const L = toRadians(normalize360(el.L0 + el.Ln * T));
  const e = el.e0 + el.en * T;
  const i = toRadians(el.i0 + el.in_ * T);
  const O = toRadians(normalize360(el.O0 + el.On * T)); // ascending node
  const w_bar = toRadians(normalize360(el.w0 + el.wn * T)); // longitude of perihelion

  // Argument of perihelion ω = ω̄ - Ω
  const w = w_bar - O;

  // Mean anomaly
  const M_rad = L - w_bar;

  // Eccentric anomaly via Newton-Raphson
  const E = solveKepler(M_rad, e);

  // True anomaly and radius vector
  const v = trueAnomaly(E, e);
  const r = el.a * (1 - e * Math.cos(E));

  // Heliocentric coordinates in orbital plane
  const xOrb = r * Math.cos(v);
  const yOrb = r * Math.sin(v);

  // Precompute trigonometric values
  const cosO = Math.cos(O);
  const sinO = Math.sin(O);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  // Rotate to ecliptic heliocentric coordinates
  const x = (cosW * cosO - sinW * sinO * cosI) * xOrb + (-sinW * cosO - cosW * sinO * cosI) * yOrb;
  const y = (cosW * sinO + sinW * cosO * cosI) * xOrb + (-sinW * sinO + cosW * cosO * cosI) * yOrb;
  const z = sinW * sinI * xOrb + cosW * sinI * yOrb;

  return { x, y, z };
}

/**
 * Determines if a planet is currently in retrograde motion
 * by comparing its longitude 1 day ahead and 1 day behind.
 *
 * @param planetName - Planet name (must be in ORBITAL_ELEMENTS)
 * @param jde - Julian Ephemeris Date
 * @returns true if retrograde (decreasing longitude)
 */
function isRetrograde(planetName: string, jde: number): boolean {
  if (planetName === 'Sun' || planetName === 'Moon') return false;

  const T_before = julianCenturies(jde - 1);
  const T_after = julianCenturies(jde + 1);

  const earthBefore = heliocentricCoordinates('Earth', T_before);
  const earthAfter = heliocentricCoordinates('Earth', T_after);
  const planetBefore = heliocentricCoordinates(planetName, T_before);
  const planetAfter = heliocentricCoordinates(planetName, T_after);

  const lonBefore = normalize360(toDegrees(Math.atan2(
    planetBefore.y - earthBefore.y,
    planetBefore.x - earthBefore.x,
  )));
  const lonAfter = normalize360(toDegrees(Math.atan2(
    planetAfter.y - earthAfter.y,
    planetAfter.x - earthAfter.x,
  )));

  // Retrograde if longitude is decreasing (accounting for 0°/360° wrap)
  const diff = normalize360(lonAfter - lonBefore);
  return diff > 180; // Motion > 180° means it wrapped backward
}

/**
 * Calculates geocentric ecliptic longitude and latitude for a planet
 * using Keplerian elements.
 *
 * @param planetName - Planet name (key in ORBITAL_ELEMENTS, not Sun/Moon)
 * @param T - Julian centuries from J2000.0
 * @returns Geocentric ecliptic {longitude, latitude} in degrees
 */
function geocentricPosition(
  planetName: string,
  T: number,
): { longitude: number; latitude: number } {
  const planet = heliocentricCoordinates(planetName, T);
  const earth = heliocentricCoordinates('Earth', T);

  // Geocentric rectangular coordinates
  const dx = planet.x - earth.x;
  const dy = planet.y - earth.y;
  const dz = planet.z - earth.z;

  const longitude = normalize360(toDegrees(Math.atan2(dy, dx)));
  const latitude = toDegrees(Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)));

  return { longitude, latitude };
}

/**
 * Calculates current planetary positions for all 10 bodies.
 * Positions are geocentric ecliptic (longitude, latitude).
 *
 * @param jde - Julian Ephemeris Date
 * @returns Array of PlanetaryPosition for all 10 bodies
 *
 * @example
 * const positions = calculatePlanetaryPositions(2451545.0);
 * // Returns Sun at ~280°, Jupiter at ~34°, etc.
 *
 * @see AC-001 — Core Layer; output feeds Event Mapper
 */
export function calculatePlanetaryPositions(jde: number): PlanetaryPosition[] {
  const T = julianCenturies(jde);
  const positions: PlanetaryPosition[] = [];

  // Sun — use accurate Chapter 25 formula
  const sunLon = calculateSunLongitude(jde);
  positions.push({
    planet: 'Sun',
    longitude: sunLon,
    latitude: 0,
    sign: longitudeToSign(sunLon) as ZodiacSign,
    degree: longitudeToSignDegree(sunLon),
    isRetrograde: false,
    dignity: evaluateDignity('Sun', sunLon),
  });

  // Moon — use simplified Chapter 47 formula
  const moonLon = calculateMoonLongitude(jde);
  const moonLat = calculateMoonLatitude(jde);
  positions.push({
    planet: 'Moon',
    longitude: moonLon,
    latitude: moonLat,
    sign: longitudeToSign(moonLon) as ZodiacSign,
    degree: longitudeToSignDegree(moonLon),
    isRetrograde: false,
    dignity: evaluateDignity('Moon', moonLon),
  });

  // All other planets via Keplerian elements
  const planets: Planet[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  for (const planet of planets) {
    const { longitude, latitude } = geocentricPosition(planet, T);
    const retrograde = isRetrograde(planet, jde);
    positions.push({
      planet,
      longitude,
      latitude,
      sign: longitudeToSign(longitude) as ZodiacSign,
      degree: longitudeToSignDegree(longitude),
      isRetrograde: retrograde,
      dignity: evaluateDignity(planet, longitude),
    });
  }

  return positions;
}
