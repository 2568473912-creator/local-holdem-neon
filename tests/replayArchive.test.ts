import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandHistoryRecord } from '../src/types/replay';
import {
  REPLAY_ARCHIVE_BOOTSTRAP_KEY,
  REPLAY_ARCHIVE_STORAGE_KEY,
  archiveReplaySession,
  buildReplayArchiveImportPreview,
  clearReplayArchive,
  createEmptyReplayArchive,
  loadReplayArchive,
  mergeReplayArchives,
  mergeReplayHistories,
  parseReplayArchiveImport,
  pickReplayArchiveSessions,
  readReplayArchive,
  summarizeReplayArchive,
  writeReplayArchive,
} from '../src/state/replayArchive';

function buildHand(overrides: Partial<HandHistoryRecord> & Pick<HandHistoryRecord, 'handId' | 'timestamp'>): HandHistoryRecord {
  return {
    sessionId: overrides.sessionId ?? 'session-a',
    handId: overrides.handId,
    timestamp: overrides.timestamp,
    gameMode: overrides.gameMode ?? 'standard',
    sessionMode: overrides.sessionMode ?? 'cash',
    aiDifficulty: overrides.aiDifficulty ?? 'standard',
    blindInfo: overrides.blindInfo ?? { smallBlind: 20, bigBlind: 40 },
    participants: overrides.participants ?? [],
    dealerSeat: overrides.dealerSeat ?? 0,
    smallBlindSeat: overrides.smallBlindSeat ?? 1,
    bigBlindSeat: overrides.bigBlindSeat ?? 2,
    startingChips: overrides.startingChips ?? { P0: 5000 },
    endingChips: overrides.endingChips ?? { P0: 5000 },
    holeCards: overrides.holeCards ?? { P0: [] },
    communityCardsRevealOrder: overrides.communityCardsRevealOrder ?? [],
    actions: overrides.actions ?? [],
    events: overrides.events ?? [],
    snapshots: overrides.snapshots ?? [],
    showdown: overrides.showdown ?? { evaluatedHands: [], winners: [] },
    winners: overrides.winners ?? [],
    payoutBreakdown: overrides.payoutBreakdown ?? [],
    potBreakdown: overrides.potBreakdown ?? [],
  };
}

function installReplayArchiveWindowMock() {
  const localStore = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => (localStore.has(key) ? localStore.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      localStore.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      localStore.delete(key);
    }),
    clear: vi.fn(() => {
      localStore.clear();
    }),
  };

  let storeCreated = false;
  const indexedDbStore = new Map<string, unknown>();
  const db = {
    objectStoreNames: {
      contains: vi.fn(() => storeCreated),
    },
    createObjectStore: vi.fn(() => {
      storeCreated = true;
      return {};
    }),
    transaction: vi.fn(() => {
      const tx = {
        error: null,
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        objectStore: vi.fn(() => ({
          get: vi.fn((key: string) => {
            const request = {
              result: indexedDbStore.get(key),
              error: null,
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
            };
            queueMicrotask(() => request.onsuccess?.());
            return request;
          }),
          put: vi.fn((value: unknown, key: string) => {
            indexedDbStore.set(key, value);
            return {};
          }),
          delete: vi.fn((key: string) => {
            indexedDbStore.delete(key);
            return {};
          }),
        })),
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }),
    close: vi.fn(),
    onclose: null as null | (() => void),
  };
  const indexedDB = {
    open: vi.fn(() => {
      const request = {
        result: db,
        error: null,
        onsuccess: null as null | (() => void),
        onerror: null as null | (() => void),
        onupgradeneeded: null as null | (() => void),
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }),
  };

  vi.stubGlobal('window', {
    localStorage,
    indexedDB,
  });

  return {
    localStore,
    indexedDbStore,
  };
}

type ReplayArchivePayload = {
  hands: HandHistoryRecord[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('replay archive', () => {
  it('archives the latest session first and replaces older copies of the same session', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T03:00:00Z'));

    const initial = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-a',
      [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })],
    );
    const replaced = archiveReplaySession(initial, 'session-a', [
      buildHand({ sessionId: 'session-a', handId: 2, timestamp: 2000 }),
      buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 }),
    ]);

    expect(replaced.archivedSessionIds).toEqual(['session-a']);
    expect(replaced.hands.map((hand) => hand.handId)).toEqual([2, 1]);
    expect(replaced.updatedAt).toBe(new Date('2026-03-12T03:00:00Z').getTime());

    vi.useRealTimers();
  });

  it('caps archived hands per session and prefers live history when merging duplicates', () => {
    const archive = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-a',
      Array.from({ length: 40 }, (_, index) => buildHand({ sessionId: 'session-a', handId: index + 1, timestamp: 1000 + index })),
    );

    expect(archive.hands).toHaveLength(30);
    expect(archive.hands[0]?.handId).toBe(40);
    expect(archive.hands.at(-1)?.handId).toBe(11);

    const merged = mergeReplayHistories(
      [buildHand({ sessionId: 'session-a', handId: 40, timestamp: 1039, winners: ['P0'] })],
      archive.hands,
    );

    expect(merged).toHaveLength(30);
    expect(merged[0]?.winners).toEqual(['P0']);
  });

  it('summarizes archived session and hand counts', () => {
    const archive = archiveReplaySession(
      archiveReplaySession(createEmptyReplayArchive(), 'session-a', [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })]),
      'session-b',
      [
        buildHand({ sessionId: 'session-b', handId: 1, timestamp: 2000 }),
        buildHand({ sessionId: 'session-b', handId: 2, timestamp: 3000 }),
      ],
    );

    expect(summarizeReplayArchive(archive)).toMatchObject({
      sessionCount: 2,
      handCount: 3,
    });
  });

  it('merges imported archives and keeps a bounded session order', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T05:00:00Z'));

    const base = archiveReplaySession(createEmptyReplayArchive(), 'session-a', [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })]);
    const incoming = archiveReplaySession(createEmptyReplayArchive(), 'session-b', [buildHand({ sessionId: 'session-b', handId: 1, timestamp: 2000 })]);
    const merged = mergeReplayArchives(base, incoming);

    expect(merged.archivedSessionIds).toEqual(['session-b', 'session-a']);
    expect(merged.hands).toHaveLength(2);
    expect(merged.updatedAt).toBe(new Date('2026-03-12T05:00:00Z').getTime());

    vi.useRealTimers();
  });

  it('parses wrapped replay archive imports and reports dropped invalid hands', () => {
    const raw = JSON.stringify({
      exportedAt: '2026-03-12T05:30:00.000Z',
      archive: {
        version: 1,
        updatedAt: 1_700,
        archivedSessionIds: ['session-a'],
        hands: [
          buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 }),
          { handId: 'oops', timestamp: 1001 },
        ],
      },
    });

    const parsed = parseReplayArchiveImport(raw);
    expect(parsed.result?.archive.hands).toHaveLength(1);
    expect(parsed.result?.archive.archivedSessionIds).toEqual(['session-a']);
    expect(parsed.result?.warning).toContain('无效手牌记录');
  });

  it('builds a useful import preview for merge and replace modes', () => {
    const current = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-a',
      [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })],
    );
    const incoming = archiveReplaySession(
      archiveReplaySession(createEmptyReplayArchive(), 'session-a', [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })]),
      'session-b',
      [buildHand({ sessionId: 'session-b', handId: 2, timestamp: 2000 })],
    );

    const mergePreview = buildReplayArchiveImportPreview(current, incoming, 'merge');
    expect(mergePreview.duplicateHandCount).toBe(1);
    expect(mergePreview.overlappingSessionIds).toEqual(['session-a']);
    expect(mergePreview.newSessionIds).toEqual(['session-b']);
    expect(mergePreview.resultSessionCount).toBe(2);
    expect(mergePreview.resultHandCount).toBe(2);
    expect(mergePreview.sessionDiffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'session-a',
          currentHandCount: 1,
          incomingHandCount: 1,
          duplicateHandCount: 1,
          newHandCount: 0,
          keptInResult: true,
          currentHandIds: [1],
          incomingHandIds: [1],
          duplicateHandIds: [1],
          newHandIds: [],
          resultHandIds: [1],
        }),
        expect.objectContaining({
          sessionId: 'session-b',
          currentHandCount: 0,
          incomingHandCount: 1,
          duplicateHandCount: 0,
          newHandCount: 1,
          keptInResult: true,
          currentHandIds: [],
          incomingHandIds: [2],
          duplicateHandIds: [],
          newHandIds: [2],
          resultHandIds: [2],
        }),
      ]),
    );

    const replacePreview = buildReplayArchiveImportPreview(current, incoming, 'replace');
    expect(replacePreview.removedSessionIds).toEqual([]);
    expect(replacePreview.resultSessionCount).toBe(2);
    expect(replacePreview.resultHandCount).toBe(2);
  });

  it('shows sessions that would be removed or overflowed in import preview', () => {
    const current = archiveReplaySession(
      archiveReplaySession(createEmptyReplayArchive(), 'session-a', [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })]),
      'session-b',
      [buildHand({ sessionId: 'session-b', handId: 1, timestamp: 2000 })],
    );
    const replaceIncoming = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-c',
      [buildHand({ sessionId: 'session-c', handId: 1, timestamp: 3000 })],
    );

    const replacePreview = buildReplayArchiveImportPreview(current, replaceIncoming, 'replace');
    expect(replacePreview.removedSessionIds).toEqual(['session-b', 'session-a']);

    const overflowCurrent = {
      ...createEmptyReplayArchive(),
      archivedSessionIds: ['session-a', 'session-b', 'session-c', 'session-d', 'session-e', 'session-f', 'session-g', 'session-h'],
      hands: [
        buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 }),
        buildHand({ sessionId: 'session-b', handId: 1, timestamp: 2000 }),
        buildHand({ sessionId: 'session-c', handId: 1, timestamp: 3000 }),
        buildHand({ sessionId: 'session-d', handId: 1, timestamp: 4000 }),
        buildHand({ sessionId: 'session-e', handId: 1, timestamp: 5000 }),
        buildHand({ sessionId: 'session-f', handId: 1, timestamp: 6000 }),
        buildHand({ sessionId: 'session-g', handId: 1, timestamp: 7000 }),
        buildHand({ sessionId: 'session-h', handId: 1, timestamp: 8000 }),
      ],
    };
    const overflowIncoming = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-i',
      [buildHand({ sessionId: 'session-i', handId: 1, timestamp: 9000 })],
    );

    const overflowPreview = buildReplayArchiveImportPreview(overflowCurrent, overflowIncoming, 'merge');
    expect(overflowPreview.overflowSessionIds).toEqual(['session-a']);
    expect(overflowPreview.sessionDiffs[0]).toEqual(
      expect.objectContaining({
        sessionId: 'session-i',
        incomingHandCount: 1,
        newHandCount: 1,
        keptInResult: true,
        incomingHandIds: [1],
        newHandIds: [1],
      }),
    );
  });

  it('can narrow an imported archive down to selected sessions before previewing', () => {
    const incoming = archiveReplaySession(
      archiveReplaySession(createEmptyReplayArchive(), 'session-a', [buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 })]),
      'session-b',
      [
        buildHand({ sessionId: 'session-b', handId: 1, timestamp: 2000 }),
        buildHand({ sessionId: 'session-b', handId: 2, timestamp: 2100 }),
      ],
    );
    const filtered = pickReplayArchiveSessions(incoming, ['session-b']);

    expect(filtered.archivedSessionIds).toEqual(['session-b']);
    expect(filtered.hands.map((hand) => hand.sessionId)).toEqual(['session-b', 'session-b']);

    const preview = buildReplayArchiveImportPreview(createEmptyReplayArchive(), filtered, 'replace');
    expect(preview.incomingSessionCount).toBe(1);
    expect(preview.incomingHandCount).toBe(2);
    expect(preview.resultSessionCount).toBe(1);
    expect(preview.newSessionIds).toEqual(['session-b']);
  });

  it('hydrates replay archive from IndexedDB and migrates legacy local storage payloads', async () => {
    const harness = installReplayArchiveWindowMock();
    const legacyArchive = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-legacy',
      Array.from({ length: 24 }, (_, index) => buildHand({ sessionId: 'session-legacy', handId: index + 1, timestamp: 1000 + index })),
    );

    harness.localStore.set(REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify(legacyArchive));
    const migrated = await loadReplayArchive();

    expect(migrated.hands).toHaveLength(24);
    expect(migrated.archivedSessionIds).toEqual(['session-legacy']);
    expect(harness.localStore.has(REPLAY_ARCHIVE_STORAGE_KEY)).toBe(false);
    expect(harness.localStore.has(REPLAY_ARCHIVE_BOOTSTRAP_KEY)).toBe(true);

    const bootstrap = readReplayArchive();
    expect(bootstrap.hands).toHaveLength(18);
    expect(bootstrap.hands[0]?.handId).toBe(24);

    const indexedDbArchive = harness.indexedDbStore.get('replay-archive') as ReplayArchivePayload | undefined;
    expect(indexedDbArchive?.hands).toHaveLength(24);

    const nextArchive = archiveReplaySession(
      createEmptyReplayArchive(),
      'session-fresh',
      Array.from({ length: 12 }, (_, index) => buildHand({ sessionId: 'session-fresh', handId: index + 1, timestamp: 2000 + index })),
    );
    writeReplayArchive(nextArchive);
    await Promise.resolve();
    await Promise.resolve();

    const loaded = await loadReplayArchive();
    expect(loaded.archivedSessionIds).toEqual(['session-fresh']);
    expect(loaded.hands).toHaveLength(12);

    clearReplayArchive();
    await Promise.resolve();
    await Promise.resolve();
    expect(readReplayArchive()).toEqual(createEmptyReplayArchive());
    expect(harness.indexedDbStore.has('replay-archive')).toBe(false);
  });
});
