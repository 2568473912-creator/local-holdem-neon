export interface TournamentPrizeTier {
  place: number;
  percentage: number;
  label: string;
}

export interface TournamentPrizeLine extends TournamentPrizeTier {
  buyInMultiplier: number;
}

interface PrizePreset {
  maxPlayers: number;
  percentages: number[];
}

const PRIZE_PRESETS: PrizePreset[] = [
  { maxPlayers: 2, percentages: [100] },
  { maxPlayers: 4, percentages: [70, 30] },
  { maxPlayers: 6, percentages: [55, 30, 15] },
  { maxPlayers: 9, percentages: [50, 30, 20] },
  { maxPlayers: 12, percentages: [45, 27, 18, 10] },
];

function placeLabel(place: number): string {
  if (place === 1) return '冠军';
  if (place === 2) return '亚军';
  if (place === 3) return '季军';
  return `第 ${place} 名`;
}

export function getTournamentPrizeStructure(playerCount: number): TournamentPrizeTier[] {
  const normalizedPlayerCount = Math.max(2, playerCount);
  const preset = PRIZE_PRESETS.find((entry) => normalizedPlayerCount <= entry.maxPlayers) ?? PRIZE_PRESETS[PRIZE_PRESETS.length - 1];
  return preset.percentages.map((percentage, index) => ({
    place: index + 1,
    percentage,
    label: placeLabel(index + 1),
  }));
}

export function getTournamentPrizeLines(playerCount: number): TournamentPrizeLine[] {
  const normalizedPlayerCount = Math.max(2, playerCount);
  return getTournamentPrizeStructure(normalizedPlayerCount).map((entry) => ({
    ...entry,
    buyInMultiplier: Number(((normalizedPlayerCount * entry.percentage) / 100).toFixed(2)),
  }));
}

export function getTournamentPrizeForRank(playerCount: number, rank: number): TournamentPrizeLine | null {
  return getTournamentPrizeLines(playerCount).find((entry) => entry.place === rank) ?? null;
}

export function getTournamentPaidPlaces(playerCount: number): number {
  return getTournamentPrizeStructure(playerCount).length;
}
