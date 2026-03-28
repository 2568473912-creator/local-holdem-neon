import type { GameConfig, TournamentStructureId } from '../types/game';

export interface TournamentLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface TournamentStructurePreset {
  id: TournamentStructureId;
  label: string;
  levels: TournamentLevel[];
}

const STANDARD_LEVELS: TournamentLevel[] = [
  { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
  { level: 2, smallBlind: 15, bigBlind: 30, ante: 0 },
  { level: 3, smallBlind: 20, bigBlind: 40, ante: 0 },
  { level: 4, smallBlind: 30, bigBlind: 60, ante: 10 },
  { level: 5, smallBlind: 40, bigBlind: 80, ante: 10 },
  { level: 6, smallBlind: 60, bigBlind: 120, ante: 20 },
  { level: 7, smallBlind: 80, bigBlind: 160, ante: 20 },
  { level: 8, smallBlind: 100, bigBlind: 200, ante: 25 },
  { level: 9, smallBlind: 150, bigBlind: 300, ante: 50 },
  { level: 10, smallBlind: 200, bigBlind: 400, ante: 50 },
  { level: 11, smallBlind: 300, bigBlind: 600, ante: 75 },
  { level: 12, smallBlind: 400, bigBlind: 800, ante: 100 },
];

const TURBO_LEVELS: TournamentLevel[] = [
  { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
  { level: 2, smallBlind: 20, bigBlind: 40, ante: 0 },
  { level: 3, smallBlind: 30, bigBlind: 60, ante: 10 },
  { level: 4, smallBlind: 40, bigBlind: 80, ante: 10 },
  { level: 5, smallBlind: 60, bigBlind: 120, ante: 20 },
  { level: 6, smallBlind: 80, bigBlind: 160, ante: 20 },
  { level: 7, smallBlind: 100, bigBlind: 200, ante: 25 },
  { level: 8, smallBlind: 150, bigBlind: 300, ante: 50 },
  { level: 9, smallBlind: 200, bigBlind: 400, ante: 50 },
  { level: 10, smallBlind: 300, bigBlind: 600, ante: 75 },
];

const DEEP_LEVELS: TournamentLevel[] = [
  { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
  { level: 2, smallBlind: 10, bigBlind: 25, ante: 0 },
  { level: 3, smallBlind: 15, bigBlind: 30, ante: 0 },
  { level: 4, smallBlind: 20, bigBlind: 40, ante: 0 },
  { level: 5, smallBlind: 25, bigBlind: 50, ante: 0 },
  { level: 6, smallBlind: 30, bigBlind: 60, ante: 10 },
  { level: 7, smallBlind: 40, bigBlind: 80, ante: 10 },
  { level: 8, smallBlind: 50, bigBlind: 100, ante: 10 },
  { level: 9, smallBlind: 60, bigBlind: 120, ante: 20 },
  { level: 10, smallBlind: 80, bigBlind: 160, ante: 20 },
  { level: 11, smallBlind: 100, bigBlind: 200, ante: 25 },
  { level: 12, smallBlind: 150, bigBlind: 300, ante: 50 },
];

export const TOURNAMENT_STRUCTURES: Record<TournamentStructureId, TournamentStructurePreset> = {
  standard: {
    id: 'standard',
    label: '标准结构',
    levels: STANDARD_LEVELS,
  },
  turbo: {
    id: 'turbo',
    label: 'Turbo 快速',
    levels: TURBO_LEVELS,
  },
  deep: {
    id: 'deep',
    label: 'Deep 深筹',
    levels: DEEP_LEVELS,
  },
};

export function getTournamentStructure(structureId: TournamentStructureId = 'standard'): TournamentStructurePreset {
  return TOURNAMENT_STRUCTURES[structureId] ?? TOURNAMENT_STRUCTURES.standard;
}

export function getTournamentLevel(config: GameConfig): TournamentLevel {
  const structure = getTournamentStructure(config.tournamentStructureId ?? 'standard');
  const requestedLevel = Math.max(1, config.blindLevel);
  return structure.levels[Math.min(structure.levels.length - 1, requestedLevel - 1)];
}

export function getNextTournamentLevel(config: GameConfig): TournamentLevel | null {
  const structure = getTournamentStructure(config.tournamentStructureId ?? 'standard');
  const nextIndex = Math.max(1, config.blindLevel);
  return structure.levels[nextIndex] ?? null;
}

export function getUpcomingTournamentLevels(config: GameConfig, count = 5): TournamentLevel[] {
  const structure = getTournamentStructure(config.tournamentStructureId ?? 'standard');
  const startIndex = Math.max(0, Math.min(structure.levels.length - 1, config.blindLevel - 1));
  return structure.levels.slice(startIndex, startIndex + Math.max(1, count));
}

export function syncTournamentConfig(config: GameConfig): GameConfig {
  if (config.sessionMode !== 'tournament') {
    return config;
  }

  const level = getTournamentLevel(config);
  return {
    ...config,
    blindLevel: level.level,
    smallBlind: level.smallBlind,
    bigBlind: level.bigBlind,
    tournamentStructureId: config.tournamentStructureId ?? 'standard',
  };
}

export function maybeAdvanceTournamentLevel(config: GameConfig, completedHands: number): { nextConfig: GameConfig; upgraded: boolean } {
  if (config.sessionMode !== 'tournament') {
    return { nextConfig: config, upgraded: false };
  }

  if (completedHands <= 0 || completedHands % Math.max(2, config.blindUpEveryHands) !== 0) {
    return { nextConfig: config, upgraded: false };
  }

  const current = syncTournamentConfig(config);
  const nextLevel = getNextTournamentLevel(current);
  if (!nextLevel) {
    return { nextConfig: current, upgraded: false };
  }

  return {
    nextConfig: {
      ...current,
      blindLevel: nextLevel.level,
      smallBlind: nextLevel.smallBlind,
      bigBlind: nextLevel.bigBlind,
      tournamentStructureId: current.tournamentStructureId ?? 'standard',
    },
    upgraded: true,
  };
}
