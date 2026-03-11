import type { ReplayEvent, ReplaySnapshot } from '../types/replay';

function cloneSnapshot(snapshot: ReplaySnapshot): ReplaySnapshot {
  return {
    ...snapshot,
    board: [...snapshot.board],
    sidePots: snapshot.sidePots.map((pot) => ({ ...pot, eligiblePlayerIds: [...pot.eligiblePlayerIds] })),
    players: snapshot.players.map((p) => ({ ...p, holeCards: [...p.holeCards] })),
  };
}

export function applyReplayEvent(prev: ReplaySnapshot, event: ReplayEvent): ReplaySnapshot {
  const next = cloneSnapshot(prev);
  next.step = event.step;
  next.eventId = event.id;
  next.note = event.note;
  next.stage = event.stage;

  switch (event.type) {
    case 'deal_hole': {
      const player = next.players.find((p) => p.id === event.actorId);
      if (player) {
        player.holeCards = [...event.cards];
      }
      break;
    }
    case 'post_blind': {
      const player = next.players.find((p) => p.id === event.actorId);
      if (player) {
        if (event.blindType !== 'ante') {
          player.currentBet += event.amount;
        }
        player.stack = event.stackAfter;
        player.lastAction = event.blindType === 'sb' ? `小盲 ${event.amount}` : event.blindType === 'bb' ? `大盲 ${event.amount}` : `前注 ${event.amount}`;
        if (player.stack === 0) {
          player.allIn = true;
        }
      }
      next.totalPot = event.potAfter;
      break;
    }
    case 'action': {
      const player = next.players.find((p) => p.id === event.actorId);
      if (player) {
        player.stack = event.stackAfter;
        player.currentBet = event.betAfter;
        if (event.isFold) {
          player.folded = true;
        }
        if (event.isAllIn) {
          player.allIn = true;
        }
        player.lastAction = event.note;
      }
      next.totalPot = event.potAfter;
      next.activePlayerId = event.activePlayerAfter;
      break;
    }
    case 'street_transition': {
      next.stage = event.to;
      next.activePlayerId = event.activePlayerId;
      if (event.resetBets) {
        next.players = next.players.map((p) => ({
          ...p,
          currentBet: 0,
        }));
      }
      break;
    }
    case 'reveal_board': {
      next.board = [...event.boardAfter];
      break;
    }
    case 'side_pot': {
      next.sidePots = [...next.sidePots, { ...event.pot, eligiblePlayerIds: [...event.pot.eligiblePlayerIds] }];
      break;
    }
    case 'showdown': {
      next.players = next.players.map((p) => ({
        ...p,
        revealed: !p.folded,
      }));
      break;
    }
    case 'payout': {
      const player = next.players.find((p) => p.id === event.payout.playerId);
      if (player) {
        player.stack += event.payout.amount;
      }
      break;
    }
    case 'elimination': {
      const player = next.players.find((p) => p.id === event.actorId);
      if (player) {
        player.eliminated = true;
      }
      break;
    }
    case 'hand_end': {
      next.stage = 'complete';
      next.activePlayerId = undefined;
      break;
    }
    case 'hand_start':
    default:
      break;
  }

  return next;
}

export function reconstructSnapshots(initial: ReplaySnapshot, events: ReplayEvent[]): ReplaySnapshot[] {
  const snapshots: ReplaySnapshot[] = [cloneSnapshot(initial)];
  let current = cloneSnapshot(initial);

  for (const event of events) {
    current = applyReplayEvent(current, event);
    snapshots.push(current);
  }

  return snapshots;
}
