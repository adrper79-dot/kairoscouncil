/**
 * @module @kairos/shared/types/game
 * Types for the game engine — match state, combat, bonds, clock.
 * These types consume astronomical output but never import engine internals (AC-001).
 */

import type { AspectType, Planet } from './astronomical.js';

/** The five Forge schools — AC-006. */
export type ForgeSchool = 'Chronos' | 'Eros' | 'Aether' | 'Lux' | 'Phoenix';

/** The six knowledge archetypes from the Knowledge Wheel. */
export type Archetype = 'Sovereign' | 'Mystic' | 'Warrior' | 'Poet' | 'Philosopher' | 'Healer';

/** Chart confidence tier — determines which stats are transit-modified. */
export type ChartConfidence = 'verified' | 'estimated' | 'attributed' | 'legendary';

/** Figure states on the battlefield. */
export type FigureState = 'Ascendant' | 'Dormant' | 'Suppressed';

/** Match modes. */
export type MatchMode = 'transit' | 'eclipse' | 'chart';

/** Forge Intensity level (1–3) — determined by Event Mapper. */
export type ForgeIntensity = 1 | 2 | 3;

/** Forge matchup modifier — AC-006. */
export type ForgeMatchup = 'strong' | 'neutral' | 'weak';

/** Named celestial events produced by the Event Mapper. */
export type CelestialEventName =
  | 'Crimson Alignment'
  | 'Venus Ascendant'
  | 'Silent Eclipse'
  | 'Mercury Fracture'
  | 'Jupiter Ascension'
  | "Saturn's Return"
  | 'Grand Confluence';

/** A historical figure card. */
export interface HistoricalFigure {
  id: string;
  name: string;
  birthDate: Date;
  birthDatePrecision: ChartConfidence;
  birthLocationLat?: number;
  birthLocationLng?: number;
  birthTimeKnown: boolean;
  archetypeSchool: Archetype;
  primaryForge: ForgeSchool;
  secondaryForge?: ForgeSchool;
  rulingPlanet: Planet;
  natalAspects: NatalAspect[];
  personalLore?: string;
  era: string;
}

/** A natal aspect stored on a figure card. */
export interface NatalAspect {
  planet1: Planet;
  planet2: Planet;
  type: AspectType;
  orb: number;
}

/** Forge intensity data for a figure at a point in time. */
export interface ForgeIntensityData {
  primary: ForgeIntensity;
  secondary: ForgeIntensity | null;
}

/**
 * Transit cache entry — cached power data for a figure.
 * Refreshed per AC-009 SLA (every 4 hours minimum).
 */
export interface TransitCacheEntry {
  figureId: string;
  calculatedAt: Date;
  transitPower: number;
  activeAspects: ActiveTransitAspect[];
  forgeIntensity: ForgeIntensityData;
  retrogradeModified: boolean;
  solarReturnActive: boolean;
  namedEvent: CelestialEventName | null;
  validUntil: Date;
}

/** An active transit aspect contributing to Transit Power. */
export interface ActiveTransitAspect {
  transitingPlanet: Planet;
  natalPlanet: Planet;
  type: AspectType;
  orb: number;
  exactnessScore: number;
  contribution: number;
}

/** A card instance in a player's deck or hand. */
export interface CardInstance {
  figureId: string;
  figure: HistoricalFigure;
  transitPower: number;
  state: FigureState;
  forgeIntensity: ForgeIntensityData;
  activeAspectBonds: AspectBond[];
  phoenixRebornTurns: number;
  dormantActionUsed: boolean;
}

/** An active aspect bond between two figures on the battlefield. */
export interface AspectBond {
  figure1Id: string;
  figure2Id: string;
  aspectType: AspectType;
  effect: AspectBondEffect;
  chronosDelayCount: number;
  isActive: boolean;
}

/** Effects produced by an aspect bond. */
export interface AspectBondEffect {
  transitPowerBonus1: number;
  transitPowerBonus2: number;
  bonusCE: number;
  specialEffect?: string;
}

/**
 * Complete match state — authoritative server-side only (AC-002).
 */
export interface MatchState {
  matchId: string;
  mode: MatchMode;
  seed: bigint;
  seedTimestamp: Date;
  turn: number;
  activePlayerId: string;
  players: MatchPlayer[];
  cosmosSnapshot: CosmosSnapshot;
  transitClocks: Record<string, number>;
  winner?: string;
  completedAt?: Date;
}

/** Per-player state within a match. */
export interface MatchPlayer {
  playerId: string;
  deck: string[];
  hand: string[];
  battlefield: CardInstance[];
  suppressedZone: CardInstance[];
  councilLeaderId: string;
  celestialEnergy: number;
  carryoverCE: number;
}

/** Cosmos snapshot consumed by the game engine. */
export interface CosmosSnapshot {
  timestamp: Date;
  activeEvents: CelestialEventName[];
  forecast: ForecastEntry[];
}

/** A forecast entry for the 2-turn strip. */
export interface ForecastEntry {
  turnsAhead: number;
  eventName: CelestialEventName | null;
  description: string;
}

/** Attack action declaration. */
export interface AttackAction {
  attackerId: string;
  targetId: string;
  forgeSchool: ForgeSchool;
}

/** Resolved attack result. */
export interface AttackResult {
  damage: number;
  transitPower: number;
  forgeIntensity: ForgeIntensity;
  forgeMatchup: ForgeMatchup;
  matchupModifier: number;
  targetSuppressed: boolean;
  squareMisfired: boolean;
  misfireTargetId?: string;
}

/** Burst trigger definition. */
export interface BurstDefinition {
  name: string;
  requiredFigureId: string;
  requiredEvent: CelestialEventName;
  requiredForge: ForgeSchool;
  additionalConditions?: string;
  effect: string;
}

/** Player profile. */
export interface Player {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastActive: Date;
}

/** Deck definition. */
export interface Deck {
  id: string;
  ownerId: string;
  name: string;
  archetypeSchool: Archetype;
  cardIds: string[];
  councilLeaderId: string;
  createdAt: Date;
  updatedAt: Date;
}
