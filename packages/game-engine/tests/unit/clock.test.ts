import { describe, it, expect } from 'vitest';
import {
  getClockTarget,
  tickTransitClock,
  checkWinCondition,
  getClockDisplay,
} from '../../src/clock/index.js';
import { initializeMatch } from '../../src/match/index.js';
import { makeCosmosSnapshot, makeDeck } from './fixtures.js';

const P1 = 'player-1';
const P2 = 'player-2';
const TIMESTAMP = new Date('2025-06-01T12:00:00Z');

function makeTransitMatch() {
  return initializeMatch({
    player1Id: P1,
    player2Id: P2,
    deck1: makeDeck('d1', P1),
    deck2: makeDeck('d2', P2),
    mode: 'transit',
    cosmosSnapshot: makeCosmosSnapshot(),
    timestamp: TIMESTAMP,
  });
}

function makeEclipseMatch() {
  return initializeMatch({
    player1Id: P1,
    player2Id: P2,
    deck1: makeDeck('d1', P1),
    deck2: makeDeck('d2', P2),
    mode: 'eclipse',
    cosmosSnapshot: makeCosmosSnapshot(),
    timestamp: TIMESTAMP,
  });
}

describe('getClockTarget', () => {
  it('Transit mode → target 13', () => {
    expect(getClockTarget('transit')).toBe(13);
  });

  it('Chart mode → target 13', () => {
    expect(getClockTarget('chart')).toBe(13);
  });

  it('Eclipse mode → target 12', () => {
    expect(getClockTarget('eclipse')).toBe(12);
  });
});

describe('tickTransitClock', () => {
  it('Transit mode: player1 clock increments by 1', () => {
    const state = makeTransitMatch();
    const next = tickTransitClock(state, P1);
    expect(next.transitClocks[P1]).toBe(1);
    expect(next.transitClocks[P2]).toBe(0);
  });

  it('Transit mode: player2 clock increments independently', () => {
    let state = makeTransitMatch();
    state = tickTransitClock(state, P1);
    state = tickTransitClock(state, P1);
    state = tickTransitClock(state, P2);
    expect(state.transitClocks[P1]).toBe(2);
    expect(state.transitClocks[P2]).toBe(1);
  });

  it('Eclipse mode: shared clock increments regardless of which player suppresses', () => {
    const state = makeEclipseMatch();
    const next = tickTransitClock(state, P1);
    expect(next.transitClocks['eclipse']).toBe(1);
  });

  it('tickTransitClock does not mutate original state', () => {
    const state = makeTransitMatch();
    tickTransitClock(state, P1);
    expect(state.transitClocks[P1]).toBe(0);
  });
});

describe('checkWinCondition', () => {
  it('Returns null when no clock has reached target', () => {
    const state = makeTransitMatch();
    expect(checkWinCondition(state)).toBeNull();
  });

  it('Returns winning player ID when clock reaches 13 (transit)', () => {
    let state = makeTransitMatch();
    // Tick P1 clock to 13
    for (let i = 0; i < 13; i++) {
      state = tickTransitClock(state, P1);
    }
    expect(checkWinCondition(state)).toBe(P1);
  });

  it('Returns "eclipse" when eclipse clock reaches 12', () => {
    let state = makeEclipseMatch();
    for (let i = 0; i < 12; i++) {
      state = tickTransitClock(state, P1);
    }
    expect(checkWinCondition(state)).toBe('eclipse');
  });

  it('Does not trigger win at clock 12 in transit mode', () => {
    let state = makeTransitMatch();
    for (let i = 0; i < 12; i++) {
      state = tickTransitClock(state, P1);
    }
    expect(checkWinCondition(state)).toBeNull();
  });
});

describe('getClockDisplay (AC-008 Lux Distortion)', () => {
  it('Without Lux viewer: returns exact clock value', () => {
    let state = makeTransitMatch();
    state = tickTransitClock(state, P1);
    state = tickTransitClock(state, P1);
    const display = getClockDisplay(state, P1);
    expect(display).toBe(2);
  });

  it('With Lux viewer: returns range object with ±1', () => {
    let state = makeTransitMatch();
    state = tickTransitClock(state, P1);
    state = tickTransitClock(state, P1);
    // Clock is 2; Lux distortion ±1 → min: 1, max: 3
    const display = getClockDisplay(state, P1, 'Lux');
    expect(typeof display).toBe('object');
    expect((display as { min: number; max: number }).min).toBe(1);
    expect((display as { min: number; max: number }).max).toBe(3);
  });

  it('Lux distortion min is clamped to 0', () => {
    const state = makeTransitMatch(); // clock = 0
    const display = getClockDisplay(state, P1, 'Lux');
    expect((display as { min: number; max: number }).min).toBe(0);
  });

  it('Eclipse mode: shows shared eclipse clock', () => {
    let state = makeEclipseMatch();
    state = tickTransitClock(state, P1);
    const display = getClockDisplay(state, P1);
    expect(display).toBe(1);
  });

  it('Non-Lux viewer gets exact value even for P2', () => {
    let state = makeTransitMatch();
    state = tickTransitClock(state, P2);
    state = tickTransitClock(state, P2);
    state = tickTransitClock(state, P2);
    const display = getClockDisplay(state, P2, 'Chronos');
    expect(display).toBe(3);
  });
});
