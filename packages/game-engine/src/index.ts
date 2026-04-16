/**
 * @module @kairos/game-engine
 * Match logic, combat, bonds, bursts, and Transit Clock management.
 *
 * AC-002: All game state is authoritative server-side.
 * AC-003: All probabilistic elements use the deterministic seed system.
 * This package consumes astronomical output but NEVER imports engine internals (AC-001).
 */

// Match state management
export * from './match/index.js';

// Combat damage calculation
export * from './combat/index.js';

// Aspect bond logic
export * from './bonds/index.js';

// Burst trigger evaluation
export * from './bursts/index.js';

// Transit Clock management
export * from './clock/index.js';

// Deterministic seed system
export * from './seed/index.js';
