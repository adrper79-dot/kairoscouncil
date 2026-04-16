import { describe, it, expect } from 'vitest';
import { ErrorCode, KairosError } from '../../src/errors/index.js';

describe('ErrorCode taxonomy', () => {
  it('Astronomical errors are in the 1xxx series', () => {
    expect(ErrorCode.EPHEMERIS_CALCULATION_FAILED).toMatch(/^KC-1/);
    expect(ErrorCode.TRANSIT_CACHE_MISS).toMatch(/^KC-1/);
    expect(ErrorCode.INVALID_BIRTH_DATE).toMatch(/^KC-1/);
    expect(ErrorCode.JULIAN_DATE_OVERFLOW).toMatch(/^KC-1/);
  });

  it('Game engine errors are in the 2xxx series', () => {
    expect(ErrorCode.INVALID_MATCH_STATE).toMatch(/^KC-2/);
    expect(ErrorCode.SEED_GENERATION_FAILED).toMatch(/^KC-2/);
    expect(ErrorCode.ILLEGAL_GAME_ACTION).toMatch(/^KC-2/);
    expect(ErrorCode.CE_INSUFFICIENT).toMatch(/^KC-2/);
  });

  it('API errors are in the 3xxx series', () => {
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toMatch(/^KC-3/);
    expect(ErrorCode.AUTH_TOKEN_INVALID).toMatch(/^KC-3/);
    expect(ErrorCode.AUTH_TOKEN_EXPIRED).toMatch(/^KC-3/);
    expect(ErrorCode.FORBIDDEN).toMatch(/^KC-3/);
  });

  it('Database errors are in the 4xxx series', () => {
    expect(ErrorCode.QUERY_FAILED).toMatch(/^KC-4/);
    expect(ErrorCode.TRANSACTION_FAILED).toMatch(/^KC-4/);
  });

  it('Economy errors are in the 5xxx series', () => {
    expect(ErrorCode.STRIPE_WEBHOOK_INVALID).toMatch(/^KC-5/);
    expect(ErrorCode.INSUFFICIENT_CREDITS).toMatch(/^KC-5/);
  });

  it('All error codes are unique', () => {
    const codes = Object.values(ErrorCode);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});

describe('KairosError class', () => {
  it('Creates error with code and message', () => {
    const err = new KairosError(ErrorCode.INVALID_MATCH_STATE, 'bad state');
    expect(err.code).toBe(ErrorCode.INVALID_MATCH_STATE);
    expect(err.message).toBe('bad state');
  });

  it('Defaults retryable to false', () => {
    const err = new KairosError(ErrorCode.AUTH_TOKEN_INVALID, 'invalid token');
    expect(err.retryable).toBe(false);
  });

  it('Accepts retryable=true', () => {
    const err = new KairosError(ErrorCode.TRANSIT_CACHE_MISS, 'cache miss', {}, true);
    expect(err.retryable).toBe(true);
  });

  it('Accepts context object', () => {
    const ctx = { matchId: 'abc123', turn: 5 };
    const err = new KairosError(ErrorCode.ILLEGAL_GAME_ACTION, 'illegal', ctx);
    expect(err.context).toEqual(ctx);
  });

  it('Is an instance of Error', () => {
    const err = new KairosError(ErrorCode.QUERY_FAILED, 'db error');
    expect(err).toBeInstanceOf(Error);
  });

  it('name is "KairosError"', () => {
    const err = new KairosError(ErrorCode.RATE_LIMIT_EXCEEDED, 'too many requests');
    expect(err.name).toBe('KairosError');
  });

  it('toJSON returns code, message, retryable', () => {
    const err = new KairosError(ErrorCode.CE_INSUFFICIENT, 'not enough CE', {}, false);
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'KC-2005',
      message: 'not enough CE',
      retryable: false,
    });
  });
});
