/**
 * @module @kairos/database
 * Neon Postgres query layer for Kairos' Council.
 * LL-003: Always use NEON_DATABASE_URL (pooled) in Workers.
 */

import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Player, Deck, HistoricalFigure, TransitCacheEntry, MatchState } from '@kairos/shared';

export type { NeonQueryFunction } from '@neondatabase/serverless';

/** Concrete Neon SQL client type (no array-mode, no full-results). */
type Sql = NeonQueryFunction<false, false>;

/**
 * Create a Neon SQL client from a database URL.
 */
export function createDb(databaseUrl: string): Sql {
  return neon(databaseUrl);
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function getPlayerById(
  sql: Sql,
  id: string,
): Promise<Player | null> {
  const rows = await sql`
    SELECT id, email, display_name, created_at, last_active
    FROM players
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToPlayer(rows[0]!);
}

export async function getPlayerByEmail(
  sql: Sql,
  email: string,
): Promise<Player | null> {
  const rows = await sql`
    SELECT id, email, display_name, created_at, last_active
    FROM players
    WHERE email = ${email}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToPlayer(rows[0]!);
}

export async function createPlayer(
  sql: Sql,
  email: string,
  displayName: string,
): Promise<Player> {
  const rows = await sql`
    INSERT INTO players (email, display_name)
    VALUES (${email}, ${displayName})
    RETURNING id, email, display_name, created_at, last_active
  `;
  return rowToPlayer(rows[0]!);
}

export async function updatePlayerLastActive(
  sql: Sql,
  id: string,
): Promise<void> {
  await sql`
    UPDATE players SET last_active = NOW() WHERE id = ${id}
  `;
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

export async function getAllFigures(
  sql: Sql,
): Promise<HistoricalFigure[]> {
  const rows = await sql`
    SELECT id, name, birth_date, birth_date_precision, birth_location_lat,
           birth_location_lng, birth_time_known, archetype_school, primary_forge,
           secondary_forge, natal_aspects, personal_lore, era
    FROM figures
    ORDER BY name
  `;
  return rows.map(rowToFigure);
}

export async function getFigureById(
  sql: Sql,
  id: string,
): Promise<HistoricalFigure | null> {
  const rows = await sql`
    SELECT id, name, birth_date, birth_date_precision, birth_location_lat,
           birth_location_lng, birth_time_known, archetype_school, primary_forge,
           secondary_forge, natal_aspects, personal_lore, era
    FROM figures
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToFigure(rows[0]!);
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export async function getDeckById(
  sql: Sql,
  id: string,
): Promise<Deck | null> {
  const rows = await sql`
    SELECT id, owner_id, name, archetype_school, card_ids, council_leader_id,
           created_at, updated_at
    FROM decks
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToDeck(rows[0]!);
}

export async function getDecksByOwner(
  sql: Sql,
  ownerId: string,
): Promise<Deck[]> {
  const rows = await sql`
    SELECT id, owner_id, name, archetype_school, card_ids, council_leader_id,
           created_at, updated_at
    FROM decks
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
  `;
  return rows.map(rowToDeck);
}

export async function createDeck(
  sql: Sql,
  ownerId: string,
  name: string,
  archetypeSchool: string,
  cardIds: string[],
  councilLeaderId: string,
): Promise<Deck> {
  const rows = await sql`
    INSERT INTO decks (owner_id, name, archetype_school, card_ids, council_leader_id)
    VALUES (
      ${ownerId},
      ${name},
      ${archetypeSchool},
      ${JSON.stringify(cardIds)},
      ${councilLeaderId}
    )
    RETURNING id, owner_id, name, archetype_school, card_ids, council_leader_id,
              created_at, updated_at
  `;
  return rowToDeck(rows[0]!);
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function createMatch(
  sql: Sql,
  state: MatchState,
): Promise<string> {
  const playerIds = state.players.map((p) => p.playerId);
  const rows = await sql`
    INSERT INTO matches (
      id, mode, seed, seed_timestamp, player_ids, match_state,
      transit_clock_states, cosmos_snapshot
    ) VALUES (
      ${state.matchId},
      ${state.mode},
      ${state.seed.toString()},
      ${state.seedTimestamp.toISOString()},
      ${JSON.stringify(playerIds)},
      ${JSON.stringify(state)},
      ${JSON.stringify(state.transitClocks)},
      ${JSON.stringify(state.cosmosSnapshot)}
    )
    RETURNING id
  `;
  return rows[0]!['id'] as string;
}

export async function getMatchById(
  sql: Sql,
  id: string,
): Promise<MatchState | null> {
  const rows = await sql`
    SELECT match_state FROM matches WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToMatchState(rows[0]!['match_state']);
}

export async function updateMatchState(
  sql: Sql,
  id: string,
  state: MatchState,
): Promise<void> {
  await sql`
    UPDATE matches
    SET match_state = ${JSON.stringify(state)},
        transit_clock_states = ${JSON.stringify(state.transitClocks)},
        cosmos_snapshot = ${JSON.stringify(state.cosmosSnapshot)}
    WHERE id = ${id}
  `;
}

export async function completeMatch(
  sql: Sql,
  id: string,
  winnerId: string,
): Promise<void> {
  await sql`
    UPDATE matches
    SET winner_id = ${winnerId}, completed_at = NOW()
    WHERE id = ${id}
  `;
}

// ---------------------------------------------------------------------------
// Transit cache
// ---------------------------------------------------------------------------

export async function getTransitCache(
  sql: Sql,
  figureId: string,
): Promise<TransitCacheEntry | null> {
  const rows = await sql`
    SELECT figure_id, calculated_at, transit_power, active_aspects,
           forge_intensity, retrograde_modified, solar_return_active,
           named_event, valid_until
    FROM transit_cache
    WHERE figure_id = ${figureId}
    ORDER BY calculated_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToTransitCacheEntry(rows[0]!);
}

export async function upsertTransitCache(
  sql: Sql,
  entry: TransitCacheEntry,
): Promise<void> {
  await sql`
    INSERT INTO transit_cache (
      figure_id, calculated_at, transit_power, active_aspects,
      forge_intensity, retrograde_modified, solar_return_active,
      named_event, valid_until
    ) VALUES (
      ${entry.figureId},
      ${entry.calculatedAt.toISOString()},
      ${entry.transitPower},
      ${JSON.stringify(entry.activeAspects)},
      ${JSON.stringify(entry.forgeIntensity)},
      ${entry.retrogradeModified},
      ${entry.solarReturnActive},
      ${entry.namedEvent},
      ${entry.validUntil.toISOString()}
    )
    ON CONFLICT (figure_id, calculated_at) DO UPDATE SET
      transit_power = EXCLUDED.transit_power,
      active_aspects = EXCLUDED.active_aspects,
      forge_intensity = EXCLUDED.forge_intensity,
      retrograde_modified = EXCLUDED.retrograde_modified,
      solar_return_active = EXCLUDED.solar_return_active,
      named_event = EXCLUDED.named_event,
      valid_until = EXCLUDED.valid_until
  `;
}

// ---------------------------------------------------------------------------
// Idempotency — for Stripe webhooks (LL-005)
// ---------------------------------------------------------------------------

export async function isEventProcessed(
  sql: Sql,
  eventId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM processed_events WHERE event_id = ${eventId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function markEventProcessed(
  sql: Sql,
  eventId: string,
  eventType: string,
): Promise<void> {
  await sql`
    INSERT INTO processed_events (event_id, event_type)
    VALUES (${eventId}, ${eventType})
    ON CONFLICT (event_id) DO NOTHING
  `;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function rowToPlayer(row: Row): Player {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    displayName: row['display_name'] as string,
    createdAt: new Date(row['created_at'] as string),
    lastActive: new Date(row['last_active'] as string),
  };
}

function rowToFigure(row: Row): HistoricalFigure {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    birthDate: new Date(row['birth_date'] as string),
    birthDatePrecision: row['birth_date_precision'] as HistoricalFigure['birthDatePrecision'],
    birthLocationLat:
      row['birth_location_lat'] != null ? Number(row['birth_location_lat']) : undefined,
    birthLocationLng:
      row['birth_location_lng'] != null ? Number(row['birth_location_lng']) : undefined,
    birthTimeKnown: row['birth_time_known'] as boolean,
    archetypeSchool: row['archetype_school'] as HistoricalFigure['archetypeSchool'],
    primaryForge: row['primary_forge'] as HistoricalFigure['primaryForge'],
    secondaryForge:
      row['secondary_forge'] != null
        ? (row['secondary_forge'] as HistoricalFigure['secondaryForge'])
        : undefined,
    rulingPlanet: ((row['ruling_planet'] ?? 'Sun') as string) as HistoricalFigure['rulingPlanet'],
    natalAspects: (typeof row['natal_aspects'] === 'string'
      ? (JSON.parse(row['natal_aspects']) as HistoricalFigure['natalAspects'])
      : (row['natal_aspects'] as HistoricalFigure['natalAspects'])),
    personalLore: row['personal_lore'] != null ? (row['personal_lore'] as string) : undefined,
    era: row['era'] as string,
  };
}

function rowToDeck(row: Row): Deck {
  return {
    id: row['id'] as string,
    ownerId: row['owner_id'] as string,
    name: row['name'] as string,
    archetypeSchool: row['archetype_school'] as Deck['archetypeSchool'],
    cardIds: (typeof row['card_ids'] === 'string'
      ? (JSON.parse(row['card_ids']) as string[])
      : (row['card_ids'] as string[])),
    councilLeaderId: row['council_leader_id'] as string,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  };
}

function rowToMatchState(raw: unknown): MatchState {
  const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  return {
    ...(obj as Omit<MatchState, 'seed' | 'seedTimestamp' | 'completedAt'>),
    seed: BigInt(obj['seed'] as string | number),
    seedTimestamp: new Date(obj['seedTimestamp'] as string),
    completedAt: obj['completedAt'] != null ? new Date(obj['completedAt'] as string) : undefined,
  };
}

function rowToTransitCacheEntry(row: Row): TransitCacheEntry {
  return {
    figureId: row['figure_id'] as string,
    calculatedAt: new Date(row['calculated_at'] as string),
    transitPower: row['transit_power'] as number,
    activeAspects: (typeof row['active_aspects'] === 'string'
      ? (JSON.parse(row['active_aspects']) as TransitCacheEntry['activeAspects'])
      : (row['active_aspects'] as TransitCacheEntry['activeAspects'])),
    forgeIntensity: (typeof row['forge_intensity'] === 'string'
      ? (JSON.parse(row['forge_intensity']) as TransitCacheEntry['forgeIntensity'])
      : (row['forge_intensity'] as TransitCacheEntry['forgeIntensity'])),
    retrogradeModified: row['retrograde_modified'] as boolean,
    solarReturnActive: row['solar_return_active'] as boolean,
    namedEvent: (row['named_event'] ?? null) as TransitCacheEntry['namedEvent'],
    validUntil: new Date(row['valid_until'] as string),
  };
}
