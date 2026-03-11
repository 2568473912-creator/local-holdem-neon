import type { SessionStats } from '../types/game';
import type { HandHistoryRecord } from '../types/replay';

export function computeSessionStats(history: HandHistoryRecord[], humanId: string): SessionStats {
  if (history.length === 0) {
    return {
      totalHands: 0,
      wins: 0,
      winRate: 0,
      totalProfit: 0,
      maxSinglePotWin: 0,
    };
  }

  let wins = 0;
  let totalProfit = 0;
  let maxSinglePotWin = 0;

  for (const hand of history) {
    if (hand.winners.includes(humanId)) {
      wins += 1;
    }

    const start = hand.startingChips[humanId] ?? 0;
    const end = hand.endingChips[humanId] ?? start;
    totalProfit += end - start;

    const handWin = hand.payoutBreakdown
      .filter((p) => p.playerId === humanId)
      .reduce((sum, p) => sum + p.amount, 0);

    maxSinglePotWin = Math.max(maxSinglePotWin, handWin);
  }

  return {
    totalHands: history.length,
    wins,
    winRate: Number(((wins / history.length) * 100).toFixed(1)),
    totalProfit,
    maxSinglePotWin,
  };
}
