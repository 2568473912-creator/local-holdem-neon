import type { ActionTeachingTag, HandHistoryRecord, ReplayEvent } from '../types/replay';

export type ReplayKeyMomentKind = 'bluff' | 'pressure' | 'elimination' | 'settlement';
export type TimelineFilterTag = 'pressure' | 'bluff' | 'elimination' | 'teaching' | 'showdown';

export interface ReplayKeyMoment {
  step: number;
  label: string;
  note: string;
  kind: ReplayKeyMomentKind;
}

function isAggressiveAction(event: ReplayEvent): boolean {
  return event.type === 'action' && (event.actionType === 'bet' || event.actionType === 'raise' || event.actionType === 'all-in');
}

function isBluffTeachingTag(tag?: ActionTeachingTag): boolean {
  return tag === 'bluff_pressure' || tag === 'semi_bluff' || tag === 'pressure_all_in';
}

function pressureAmountThreshold(bigBlind: number, pressureThresholdBB: number): number {
  return Math.max(1, Math.round(bigBlind * pressureThresholdBB));
}

export function detectSuspiciousBluffLines(record: HandHistoryRecord): Map<number, string> {
  const result = new Map<number, string>();
  const playerNameById = new Map(record.participants.map((participant) => [participant.id, participant.name]));

  for (let i = 0; i < record.events.length; i += 1) {
    const event = record.events[i];
    if (event.type !== 'action') continue;
    if (!isBluffTeachingTag(event.teachingTag)) continue;

    const actorId = event.actorId;
    let sawPressureFold = false;
    let reachedShowdown = false;
    let actorWon = false;

    for (let j = i + 1; j < record.events.length; j += 1) {
      const next = record.events[j];

      if (next.type === 'showdown') {
        reachedShowdown = true;
      } else if (next.type === 'action' && next.actionType === 'fold' && next.actorId !== actorId && next.toCall > 0) {
        sawPressureFold = true;
      } else if (next.type === 'hand_end') {
        actorWon = next.winners.includes(actorId);
        break;
      }
    }

    if (actorWon && !reachedShowdown) {
      const actorName = playerNameById.get(actorId) ?? actorId;
      const note = sawPressureFold
        ? `${actorName} 施压后逼退对手并收池，可能是诈唬成功线`
        : `${actorName} 带诈唬标签下注后未摊牌收池，建议复盘下注动机`;
      result.set(event.step, note);
    }
  }

  return result;
}

export function buildReplayKeyMoments(
  record: HandHistoryRecord,
  suspiciousBluffLines: Map<number, string>,
  pressureThresholdBB: number,
  maxMoments = 14,
): ReplayKeyMoment[] {
  const moments: ReplayKeyMoment[] = [];
  const seenSteps = new Set<number>();
  const minPressureAmount = pressureAmountThreshold(record.blindInfo.bigBlind, pressureThresholdBB);

  for (const event of record.events) {
    let label: string | null = null;
    let note = event.note;
    let kind: ReplayKeyMomentKind = 'pressure';

    if (event.type === 'action') {
      const bluffNote = suspiciousBluffLines.get(event.step);
      if (bluffNote) {
        label = '可疑诈唬线';
        note = bluffNote;
        kind = 'bluff';
      } else if (event.isAllIn) {
        label = '全下节点';
        kind = 'pressure';
      } else if ((event.actionType === 'bet' || event.actionType === 'raise') && event.amount >= minPressureAmount) {
        const bb = (event.amount / Math.max(1, record.blindInfo.bigBlind)).toFixed(1);
        label = `大额施压 ${bb}BB`;
        kind = 'pressure';
      } else if (event.isFold && event.toCall >= minPressureAmount) {
        label = '关键弃牌';
        kind = 'pressure';
      }
    } else if (event.type === 'side_pot') {
      label = '边池创建';
      note = `${event.pot.id}：${event.pot.amount}`;
      kind = 'settlement';
    } else if (event.type === 'elimination') {
      label = '玩家淘汰';
      kind = 'elimination';
    } else if (event.type === 'showdown') {
      label = '进入摊牌';
      kind = 'settlement';
    } else if (event.type === 'hand_end') {
      label = '手牌结束';
      kind = 'settlement';
    }

    if (!label || seenSteps.has(event.step)) continue;
    seenSteps.add(event.step);
    moments.push({
      step: event.step,
      label,
      note,
      kind,
    });
  }

  return moments.slice(0, maxMoments);
}

function matchesTimelineTag(
  event: ReplayEvent,
  tag: TimelineFilterTag,
  suspiciousBluffLines: Map<number, string>,
  minPressureAmount: number,
): boolean {
  switch (tag) {
    case 'pressure':
      return isAggressiveAction(event) && (event.type === 'action' ? event.amount >= minPressureAmount : false);
    case 'bluff':
      return suspiciousBluffLines.has(event.step) || (event.type === 'action' && isBluffTeachingTag(event.teachingTag));
    case 'elimination':
      return event.type === 'elimination';
    case 'teaching':
      return event.type === 'action' && Boolean(event.teachingTag);
    case 'showdown':
      return event.type === 'showdown' || event.type === 'hand_end';
    default:
      return false;
  }
}

export function filterReplayEvents(
  events: ReplayEvent[],
  selectedTags: Set<TimelineFilterTag>,
  suspiciousBluffLines: Map<number, string>,
  bigBlind: number,
  pressureThresholdBB: number,
): ReplayEvent[] {
  if (selectedTags.size === 0) {
    return events;
  }

  const minPressureAmount = pressureAmountThreshold(bigBlind, pressureThresholdBB);
  return events.filter((event) => {
    for (const tag of selectedTags) {
      if (matchesTimelineTag(event, tag, suspiciousBluffLines, minPressureAmount)) {
        return true;
      }
    }
    return false;
  });
}
