/**
 * @module @kairos/game-engine/seed
 * Deterministic seed system — AC-003.
 * Every match locked to timestamp+seed at initiation.
 * Math.random() is BANNED — use this module for all probabilistic elements.
 */

/**
 * Mulberry32 pseudo-random number generator.
 * AC-003: All randomness in the game engine must use this class.
 * Math.random() is banned.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns the next pseudo-random float in [0, 1).
   */
  next(): number {
    let z = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer in [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random float in [min, max).
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns a new shuffled copy of the array using Fisher-Yates.
   * Does not mutate the original.
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }
}

/**
 * Creates a deterministic bigint seed derived from a timestamp.
 * Used to initialise MatchState.seed at match creation time.
 */
export function createMatchSeed(timestamp: Date): bigint {
  const ms = BigInt(timestamp.getTime());
  // LCG-style bit-mixing for better distribution across close timestamps
  return (ms * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
}

/**
 * Converts a bigint seed to an unsigned 32-bit number suitable for Mulberry32.
 */
export function bigintToSeed(seed: bigint): number {
  return Number(seed & 0xffffffffn) >>> 0;
}
