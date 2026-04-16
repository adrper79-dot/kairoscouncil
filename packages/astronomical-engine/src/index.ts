/**
 * @module @kairos/astronomical-engine
 * Jean Meeus astronomical calculation engine.
 *
 * AC-001: This is the Core Layer. It is NEVER modified for balance.
 * All balance tuning happens in the Event Mapper.
 * This package must never import from @kairos/game-engine.
 *
 * Exports: CosmosState, TransitData, AspectData via @kairos/shared types.
 */

// Core Layer — Meeus calculations
export * from './core/index.js';

// Event Mapper — raw calculations → named game states
export * from './event-mapper/index.js';

// Transit Cache management (Task 4)
export * from './cache/index.js';
