import { describe, it, expect } from 'vitest';
import { SeededRandom, createMatchSeed, bigintToSeed } from '../../src/seed/index.js';

describe('SeededRandom (Mulberry32)', () => {
  it('next() returns value in [0, 1)', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('Same seed produces same sequence (deterministic)', () => {
    const rng1 = new SeededRandom(99999);
    const rng2 = new SeededRandom(99999);
    for (let i = 0; i < 20; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('Different seeds produce different sequences', () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it('nextInt returns value within [min, max] inclusive', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 200; i++) {
      const v = rng.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('nextFloat returns value within [min, max)', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('shuffle returns an array of same length', () => {
    const rng = new SeededRandom(7);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(arr);
    expect(shuffled).toHaveLength(arr.length);
  });

  it('shuffle contains all original elements', () => {
    const rng = new SeededRandom(7);
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort()).toEqual([...arr].sort());
  });

  it('shuffle does not mutate the original array', () => {
    const rng = new SeededRandom(7);
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    rng.shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('shuffle is deterministic with the same seed', () => {
    const arr = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const rng1 = new SeededRandom(100);
    const rng2 = new SeededRandom(100);
    expect(rng1.shuffle(arr)).toEqual(rng2.shuffle(arr));
  });

  it('shuffle of an empty array returns an empty array', () => {
    const rng = new SeededRandom(1);
    expect(rng.shuffle([])).toEqual([]);
  });
});

describe('createMatchSeed', () => {
  it('Returns a BigInt', () => {
    const seed = createMatchSeed(new Date('2025-01-01T00:00:00Z'));
    expect(typeof seed).toBe('bigint');
  });

  it('Same timestamp produces same seed', () => {
    const ts = new Date('2025-06-15T12:00:00Z');
    expect(createMatchSeed(ts)).toBe(createMatchSeed(ts));
  });

  it('Different timestamps produce different seeds', () => {
    const ts1 = new Date('2025-06-15T12:00:00Z');
    const ts2 = new Date('2025-06-15T12:00:01Z');
    expect(createMatchSeed(ts1)).not.toBe(createMatchSeed(ts2));
  });

  it('Seed is non-negative', () => {
    const seed = createMatchSeed(new Date());
    expect(seed).toBeGreaterThanOrEqual(0n);
  });
});

describe('bigintToSeed', () => {
  it('Returns a positive 32-bit number', () => {
    const seed = bigintToSeed(12345678901234567890n);
    expect(typeof seed).toBe('number');
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('Is stable for the same input', () => {
    const big = 9999999999999n;
    expect(bigintToSeed(big)).toBe(bigintToSeed(big));
  });
});
