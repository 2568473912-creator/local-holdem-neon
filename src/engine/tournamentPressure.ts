import { getTournamentPaidPlaces } from './tournamentPrize';
import { getNextTournamentLevel, getTournamentLevel } from './tournamentStructure';
import type { GameConfig, PlayerState } from '../types/game';

type PressureZone = 'comfortable' | 'caution' | 'pushFold' | 'critical';
type BubbleState = 'inMoney' | 'bubble' | 'nearBubble' | 'far';

export interface TournamentPressureReport {
  heroRank: number | null;
  paidPlaces: number;
  aliveCount: number;
  averageStack: number;
  heroBigBlinds: number;
  heroM: number;
  nextLevelBigBlinds: number | null;
  nextLevelM: number | null;
  zone: PressureZone;
  zoneLabel: string;
  bubbleState: BubbleState;
  bubbleLabel: string;
  recommendation: string;
}

function getZoneFromM(mValue: number): PressureZone {
  if (mValue >= 20) return 'comfortable';
  if (mValue >= 10) return 'caution';
  if (mValue >= 6) return 'pushFold';
  return 'critical';
}

function zoneLabel(zone: PressureZone): string {
  if (zone === 'comfortable') return '舒适区';
  if (zone === 'caution') return '警戒区';
  if (zone === 'pushFold') return '推弃区';
  return '危急区';
}

function getBubbleState(heroRank: number | null, paidPlaces: number): BubbleState {
  if (!heroRank) {
    return 'far';
  }
  if (heroRank <= paidPlaces) {
    return 'inMoney';
  }
  if (heroRank === paidPlaces + 1) {
    return 'bubble';
  }
  if (heroRank <= paidPlaces + 2) {
    return 'nearBubble';
  }
  return 'far';
}

function bubbleLabel(state: BubbleState, heroRank: number | null, paidPlaces: number): string {
  if (!heroRank) {
    return '未找到人类玩家';
  }
  if (state === 'inMoney') {
    return `已进入奖励圈，第 ${heroRank} 名`;
  }
  if (state === 'bubble') {
    return '当前处于奖励圈泡沫位';
  }
  if (state === 'nearBubble') {
    return `距离奖励圈还差 ${Math.max(1, heroRank - paidPlaces)} 个名次`;
  }
  return `距离奖励圈还差 ${heroRank - paidPlaces} 个名次`;
}

function recommendationFor(zone: PressureZone, bubble: BubbleState): string {
  if (bubble === 'bubble' && (zone === 'critical' || zone === 'pushFold')) {
    return '接近奖励圈且筹码承压，优先寻找率先全下或高权益再推进的时机，避免被动跟注耗尽弃牌率。';
  }
  if (bubble === 'inMoney' && zone === 'critical') {
    return '已进奖励圈但处于危急短码区，继续等待只会快速失去弃牌率，应优先争取首入池的全下机会。';
  }
  if (zone === 'comfortable') {
    return '当前筹码处于舒适区，可以继续利用位置和筹码深度压迫中短码，避免无必要的大底池碰撞。';
  }
  if (zone === 'caution') {
    return '筹码已进入警戒区，减少边缘跟注，优先保留主动权，翻前争夺盲注和后位偷盲价值更高。';
  }
  if (zone === 'pushFold') {
    return '已接近推弃区，复杂多街博弈收益下降，应减少被动跟注，优先选择高权益的主动推进。';
  }
  return '筹码极短，等待只会继续被盲注吞噬，优先寻找能率先入池的全下点，避免用弱牌被动补齐。';
}

function orbitCostForLevel(config: GameConfig, aliveCount: number, ante: number): number {
  return config.smallBlind + config.bigBlind + ante * Math.max(2, aliveCount);
}

export function analyzeTournamentPressure(
  config: GameConfig,
  players: Array<Pick<PlayerState, 'id' | 'isHuman' | 'stack' | 'eliminated'>>,
): TournamentPressureReport {
  const alivePlayers = players.filter((player) => !player.eliminated);
  const averageStack = alivePlayers.length > 0 ? Math.round(alivePlayers.reduce((sum, player) => sum + player.stack, 0) / alivePlayers.length) : 0;
  const paidPlaces = getTournamentPaidPlaces(players.length);
  const hero = players.find((player) => player.isHuman) ?? null;
  const heroRank =
    hero
      ? [...players]
          .sort((a, b) => {
            if (a.eliminated !== b.eliminated) {
              return a.eliminated ? 1 : -1;
            }
            return b.stack - a.stack;
          })
          .findIndex((player) => player.id === hero.id) + 1
      : null;
  const currentLevel = getTournamentLevel(config);
  const nextLevel = getNextTournamentLevel(config);
  const heroBigBlinds = hero ? Number((hero.stack / Math.max(1, config.bigBlind)).toFixed(2)) : 0;
  const heroM = hero
    ? Number((hero.stack / Math.max(1, orbitCostForLevel(config, alivePlayers.length, currentLevel.ante))).toFixed(2))
    : 0;
  const nextLevelBigBlinds =
    hero && nextLevel ? Number((hero.stack / Math.max(1, nextLevel.bigBlind)).toFixed(2)) : null;
  const nextLevelM =
    hero && nextLevel
      ? Number((hero.stack / Math.max(1, nextLevel.smallBlind + nextLevel.bigBlind + nextLevel.ante * Math.max(2, alivePlayers.length))).toFixed(2))
      : null;

  const zone = getZoneFromM(heroM);
  const bubbleState = getBubbleState(heroRank, paidPlaces);

  return {
    heroRank,
    paidPlaces,
    aliveCount: alivePlayers.length,
    averageStack,
    heroBigBlinds,
    heroM,
    nextLevelBigBlinds,
    nextLevelM,
    zone,
    zoneLabel: zoneLabel(zone),
    bubbleState,
    bubbleLabel: bubbleLabel(bubbleState, heroRank, paidPlaces),
    recommendation: recommendationFor(zone, bubbleState),
  };
}
