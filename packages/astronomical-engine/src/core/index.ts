/**
 * @module @kairos/astronomical-engine/core
 * Core Layer exports — the AC-001 public API for the astronomical engine.
 * Only pure astronomical functions live here. No game balance values.
 */

// Constants and epoch
export { J2000, GREGORIAN_REFORM_JDE, ORBITAL_ELEMENTS, FORGE_RULING_PLANETS } from './constants.js';

// Math utilities
export {
  toRadians,
  toDegrees,
  normalize360,
  angularDifferenceSigned,
  angularSeparation,
  longitudeToSign,
  longitudeToSignDegree,
  solveKepler,
  trueAnomaly,
} from './math-utils.js';

// Julian Date conversion
export {
  dateToJDE,
  jdeToDate,
  jsDateToJDE,
  julianCenturies,
} from './julian-date.js';

// Planetary positions
export { calculateSunLongitude, calculateSunDistance } from './solar-position.js';
export { calculateMoonLongitude, calculateMoonLatitude } from './lunar-position.js';
export { calculatePlanetaryPositions } from './planetary-positions.js';

// Aspects and dignity
export {
  getAspectType,
  calculateOrbAndExactness,
  detectAspects,
  detectTransits,
} from './aspects.js';
export { evaluateDignity } from './dignity.js';

// Natal chart and cosmos state
export { computeNatalChart, computeNatalChartFromBirthData } from './natal-chart.js';
export type { NatalChartInput } from './natal-chart.js';
export { computeCosmosState, computeCosmosStateFromDate } from './cosmos-state.js';
