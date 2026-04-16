import { describe, it, expect } from 'vitest';
import {
  initializeMatch,
  drawOpeningHand,
  startTurn,
  calculateCeForTurn,
} from '../../src/match/index.js';
import { makeCosmosSnapshot, makeDeck } from './fixtures.js';

const P1 = 'player-1';
const P2 = 'player-2';
const TIMESTAMP = new Date('2025-06-01T12:00:00Z');

function makeBaseMatch() {
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

describe('calculateCeForTurn (AC-007)', () => {
  it('No events → base CE is 3', () => {
    expect(calculateCeForTurn([])).toBe(3);
  });

  it('1 active event → CE is 4', () => {
    expect(calculateCeForTurn(['Crimson Alignment'])).toBe(4);
  });

  it('3 active events → CE is 6', () => {
    expect(calculateCeForTurn(['Crimson Alignment', 'Venus Ascendant', 'Grand Confluence'])).toBe(6);
  });

  it('4 active events → CE is 7 (but cap applied in startTurn)', () => {
    // calculateCeForTurn returns raw base; cap is applied in startTurn
    expect(calculateCeForTurn(['Crimson Alignment', 'Venus Ascendant', 'Grand Confluence', 'Mercury Fracture'])).toBe(7);
  });
});

describe('initializeMatch', () => {
  it('Returns a MatchState with turn=0', () => {
    const state = makeBaseMatch();
    expect(state.turn).toBe(0);
  });

  it('activePlayerId is player1', () => {
    const state = makeBaseMatch();
    expect(state.activePlayerId).toBe(P1);
  });

  it('Both players start with empty hands', () => {
    const state = makeBaseMatch();
    for (const p of state.players) {
      expect(p.hand).toHaveLength(0);
    }
  });

  it('Both players start with 3 base CE (AC-007)', () => {
    const state = makeBaseMatch();
    for (const p of state.players) {
      expect(p.celestialEnergy).toBe(3);
    }
  });

  it('Shuffled deck has same length as input deck', () => {
    const state = makeBaseMatch();
    for (const p of state.players) {
      expect(p.deck).toHaveLength(20);
    }
  });

  it('matchId is deterministic for the same inputs', () => {
    const s1 = makeBaseMatch();
    const s2 = makeBaseMatch();
    expect(s1.matchId).toBe(s2.matchId);
  });

  it('matchId differs for different timestamps', () => {
    const s1 = makeBaseMatch();
    const s2 = initializeMatch({
      player1Id: P1,
      player2Id: P2,
      deck1: makeDeck('d1', P1),
      deck2: makeDeck('d2', P2),
      mode: 'transit',
      cosmosSnapshot: makeCosmosSnapshot(),
      timestamp: new Date('2025-07-01T12:00:00Z'),
    });
    expect(s1.matchId).not.toBe(s2.matchId);
  });

  it('Transit mode sets per-player clocks', () => {
    const state = makeBaseMatch();
    expect(state.transitClocks).toHaveProperty(P1, 0);
    expect(state.transitClocks).toHaveProperty(P2, 0);
  });

  it('Eclipse mode sets a single shared clock', () => {
    const state = initializeMatch({
      player1Id: P1,
      player2Id: P2,
      deck1: makeDeck('d1', P1),
      deck2: makeDeck('d2', P2),
      mode: 'eclipse',
      cosmosSnapshot: makeCosmosSnapshot(),
      timestamp: TIMESTAMP,
    });
    expect(state.transitClocks).toHaveProperty('eclipse', 0);
    expect(state.transitClocks).not.toHaveProperty(P1);
  });

  it('Deck shuffle is deterministic (same timestamp → same order)', () => {
    const s1 = makeBaseMatch();
    const s2 = makeBaseMatch();
    expect(s1.players[0]?.deck).toEqual(s2.players[0]?.deck);
  });

  it('Deck shuffle produces different order from original', () => {
    const original = Array.from({ length: 20 }, (_, i) => `card-${i}`);
    const state = makeBaseMatch();
    // Very unlikely all 20 cards end up in original order
    expect(state.players[0]?.deck).not.toEqual(original);
  });
});

describe('drawOpeningHand', () => {
  it('Each player has 5 cards in hand after drawOpeningHand', () => {
    const state = drawOpeningHand(makeBaseMatch());
    for (const p of state.players) {
      expect(p.hand).toHaveLength(5);
    }
  });

  it('Deck shrinks by 5 after drawOpeningHand', () => {
    const state = drawOpeningHand(makeBaseMatch());
    for (const p of state.players) {
      expect(p.deck).toHaveLength(15);
    }
  });

  it('Opening hand cards come from the top of the deck', () => {
    const base = makeBaseMatch();
    const topFive = base.players[0]!.deck.slice(0, 5);
    const drawn = drawOpeningHand(base);
    expect(drawn.players[0]!.hand).toEqual(topFive);
  });
});

describe('startTurn', () => {
  it('Increments turn counter', () => {
    const state = drawOpeningHand(makeBaseMatch());
    const next = startTurn(state, makeCosmosSnapshot());
    expect(next.turn).toBe(1);
  });

  it('Active player draws 1 card from deck', () => {
    const state = drawOpeningHand(makeBaseMatch());
    const activePlayer = state.players.find((p) => p.playerId === state.activePlayerId)!;
    const handSizeBefore = activePlayer.hand.length;
    const next = startTurn(state, makeCosmosSnapshot());
    const activeAfter = next.players.find((p) => p.playerId === next.activePlayerId)!;
    expect(activeAfter.hand).toHaveLength(handSizeBefore + 1);
  });

  it('CE is capped at 7 even with many active events (AC-007)', () => {
    const state = drawOpeningHand(makeBaseMatch());
    const cosmos = makeCosmosSnapshot({
      activeEvents: ['Crimson Alignment', 'Venus Ascendant', 'Grand Confluence', 'Mercury Fracture', "Saturn's Return"],
    });
    const next = startTurn(state, cosmos);
    const activePlayer = next.players.find((p) => p.playerId === next.activePlayerId)!;
    expect(activePlayer.celestialEnergy).toBeLessThanOrEqual(7);
  });

  it('Carryover of 1 CE is added to next turn total', () => {
    let state = drawOpeningHand(makeBaseMatch());
    // Give the active player 2 leftover CE (carryoverCE = 2; capped at 1)
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, carryoverCE: 2 } : p,
      ),
    };
    const next = startTurn(state, makeCosmosSnapshot({ activeEvents: [] }));
    const active = next.players.find((p) => p.playerId === P1)!;
    // base 3 + carryover min(2,1)=1 = 4
    expect(active.celestialEnergy).toBe(4);
  });

  it('Updates cosmos snapshot in match state', () => {
    const state = drawOpeningHand(makeBaseMatch());
    const newCosmos = makeCosmosSnapshot({
      activeEvents: ['Crimson Alignment'],
      timestamp: new Date('2025-06-02T00:00:00Z'),
    });
    const next = startTurn(state, newCosmos);
    expect(next.cosmosSnapshot.activeEvents).toContain('Crimson Alignment');
  });
});
