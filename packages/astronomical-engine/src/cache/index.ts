/**
 * @module @kairos/astronomical-engine/cache
 * In-memory transit cache with Cloudflare KV backing.
 * AC-009: Refresh every 4 hours minimum. Sub-1° transits within 15 min.
 */

import type { TransitCacheEntry } from '@kairos/shared';

/** Cache refresh interval: 4 hours in ms */
export const CACHE_REFRESH_MS = 4 * 60 * 60 * 1000;

/** Sub-1° transit notification threshold: 15 minutes in ms */
export const SUB_DEGREE_REFRESH_MS = 15 * 60 * 1000;

/**
 * Check if a cache entry is still valid.
 */
export function isCacheValid(entry: TransitCacheEntry): boolean {
  return entry.validUntil.getTime() > Date.now();
}

/**
 * Get the refresh interval for a cache entry based on active transits.
 * Sub-1° transits require 15-minute refresh; otherwise 4-hour refresh.
 */
export function getCacheRefreshInterval(entry: TransitCacheEntry): number {
  return hasSubDegreTransit(entry) ? SUB_DEGREE_REFRESH_MS : CACHE_REFRESH_MS;
}

/**
 * Serialize a TransitCacheEntry to a JSON-compatible string for KV storage.
 */
export function serializeEntry(entry: TransitCacheEntry): string {
  return JSON.stringify({
    ...entry,
    calculatedAt: entry.calculatedAt.toISOString(),
    validUntil: entry.validUntil.toISOString(),
  });
}

/**
 * Deserialize a TransitCacheEntry from KV storage.
 */
export function deserializeEntry(raw: string): TransitCacheEntry {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    ...(parsed as Omit<TransitCacheEntry, 'calculatedAt' | 'validUntil'>),
    calculatedAt: new Date(parsed['calculatedAt'] as string),
    validUntil: new Date(parsed['validUntil'] as string),
  };
}

/**
 * Build a KV key for a figure's transit cache entry.
 */
export function buildCacheKey(figureId: string): string {
  return `transit:${figureId}`;
}

/**
 * Check if any active transit aspect has orb < 1°.
 * These require more frequent refresh per AC-009.
 */
export function hasSubDegreTransit(entry: TransitCacheEntry): boolean {
  return entry.activeAspects.some((aspect) => aspect.orb < 1);
}
