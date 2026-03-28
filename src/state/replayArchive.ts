import type { HandHistoryRecord } from '../types/replay';
import { getHandHistoryRecordKey } from '../replay/replayRecordKey';

export interface ReplayArchive {
  version: 1;
  updatedAt: number;
  archivedSessionIds: string[];
  hands: HandHistoryRecord[];
}

export interface ReplayArchiveSummary {
  sessionCount: number;
  handCount: number;
  updatedAt: number | null;
}

interface ReplayArchiveImportPayload {
  exportedAt?: string;
  archive?: unknown;
}

export interface ReplayArchiveImportResult {
  archive: ReplayArchive;
  warning?: string;
}

export type ReplayArchiveImportMode = 'replace' | 'merge';

export interface ReplayArchiveImportSessionDiff {
  sessionId: string;
  gameMode: HandHistoryRecord['gameMode'];
  sessionMode: HandHistoryRecord['sessionMode'];
  aiDifficulty: HandHistoryRecord['aiDifficulty'];
  endedAt: number;
  currentHandCount: number;
  incomingHandCount: number;
  duplicateHandCount: number;
  newHandCount: number;
  resultHandCount: number;
  keptInResult: boolean;
  currentHandIds: number[];
  incomingHandIds: number[];
  duplicateHandIds: number[];
  newHandIds: number[];
  resultHandIds: number[];
}

export interface ReplayArchiveImportPreview {
  mode: ReplayArchiveImportMode;
  currentSessionCount: number;
  currentHandCount: number;
  incomingSessionCount: number;
  incomingHandCount: number;
  resultSessionCount: number;
  resultHandCount: number;
  duplicateHandCount: number;
  overlappingSessionIds: string[];
  newSessionIds: string[];
  removedSessionIds: string[];
  overflowSessionIds: string[];
  sessionDiffs: ReplayArchiveImportSessionDiff[];
}

export const REPLAY_ARCHIVE_STORAGE_KEY = 'neon.holdem.replay-archive.v1';
export const REPLAY_ARCHIVE_BOOTSTRAP_KEY = 'neon.holdem.replay-archive-bootstrap.v1';
export const MAX_ARCHIVED_SESSIONS = 8;
export const MAX_ARCHIVED_HANDS_PER_SESSION = 30;
const MAX_ARCHIVED_HANDS_TOTAL = 180;
const MAX_BOOTSTRAP_ARCHIVED_SESSIONS = 2;
const MAX_BOOTSTRAP_ARCHIVED_HANDS = 18;
const GAME_MODES = ['standard', 'shortDeck', 'omaha', 'plo', 'stud'] as const;
const SESSION_MODES = ['cash', 'tournament'] as const;
const AI_DIFFICULTIES = ['conservative', 'standard', 'aggressive'] as const;
const REPLAY_ARCHIVE_DB_NAME = 'neon-holdem-db';
const REPLAY_ARCHIVE_DB_VERSION = 1;
const REPLAY_ARCHIVE_DB_STORE = 'app-storage';
const REPLAY_ARCHIVE_DB_KEY = 'replay-archive';

let replayArchiveDbPromise: Promise<IDBDatabase> | null = null;

export function createEmptyReplayArchive(): ReplayArchive {
  return {
    version: 1,
    updatedAt: 0,
    archivedSessionIds: [],
    hands: [],
  };
}

function sortNewestFirst(a: HandHistoryRecord, b: HandHistoryRecord): number {
  if (b.timestamp !== a.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return b.handId - a.handId;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidHandHistoryRecord(value: unknown): value is HandHistoryRecord {
  if (!isObject(value)) {
    return false;
  }

  if (!isFiniteNumber(value.handId) || !isFiniteNumber(value.timestamp)) {
    return false;
  }

  if (typeof value.sessionId !== 'undefined' && typeof value.sessionId !== 'string') {
    return false;
  }

  if (
    typeof value.gameMode !== 'string' ||
    !GAME_MODES.includes(value.gameMode as (typeof GAME_MODES)[number]) ||
    typeof value.sessionMode !== 'string' ||
    !SESSION_MODES.includes(value.sessionMode as (typeof SESSION_MODES)[number]) ||
    typeof value.aiDifficulty !== 'string' ||
    !AI_DIFFICULTIES.includes(value.aiDifficulty as (typeof AI_DIFFICULTIES)[number])
  ) {
    return false;
  }

  if (!isObject(value.blindInfo) || !isFiniteNumber(value.blindInfo.smallBlind) || !isFiniteNumber(value.blindInfo.bigBlind)) {
    return false;
  }

  return (
    Array.isArray(value.participants) &&
    isObject(value.startingChips) &&
    isObject(value.endingChips) &&
    isObject(value.holeCards) &&
    Array.isArray(value.communityCardsRevealOrder) &&
    Array.isArray(value.actions) &&
    Array.isArray(value.events) &&
    Array.isArray(value.snapshots) &&
    isObject(value.showdown) &&
    Array.isArray(value.winners) &&
    Array.isArray(value.payoutBreakdown) &&
    Array.isArray(value.potBreakdown)
  );
}

function normalizeArchiveHands(hands: HandHistoryRecord[], fallbackSessionId?: string): HandHistoryRecord[] {
  const deduped = new Map<string, HandHistoryRecord>();

  for (const hand of hands) {
    const normalized = {
      ...hand,
      sessionId: hand.sessionId ?? fallbackSessionId,
    };

    if (!normalized.sessionId) {
      continue;
    }

    deduped.set(getHandHistoryRecordKey(normalized), normalized);
  }

  return [...deduped.values()].sort(sortNewestFirst);
}

function deriveArchivedSessionIds(hands: HandHistoryRecord[], preferred: string[] = []): string[] {
  const latestBySession = new Map<string, number>();

  for (const hand of hands) {
    if (!hand.sessionId) {
      continue;
    }
    latestBySession.set(hand.sessionId, Math.max(latestBySession.get(hand.sessionId) ?? 0, hand.timestamp));
  }

  const preferredFiltered = preferred.filter((sessionId, index) => preferred.indexOf(sessionId) === index && latestBySession.has(sessionId));
  const preferredRank = new Map(preferredFiltered.map((sessionId, index) => [sessionId, index]));

  return [...latestBySession.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return (preferredRank.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (preferredRank.get(b[0]) ?? Number.MAX_SAFE_INTEGER);
    })
    .map(([sessionId]) => sessionId)
    .slice(0, MAX_ARCHIVED_SESSIONS);
}

function capArchiveHands(sessionIds: string[], hands: HandHistoryRecord[]): HandHistoryRecord[] {
  const allowed = new Set(sessionIds.slice(0, MAX_ARCHIVED_SESSIONS));
  const grouped = new Map<string, HandHistoryRecord[]>();

  for (const hand of hands) {
    if (!hand.sessionId || !allowed.has(hand.sessionId)) {
      continue;
    }
    const bucket = grouped.get(hand.sessionId);
    if (bucket) {
      bucket.push(hand);
    } else {
      grouped.set(hand.sessionId, [hand]);
    }
  }

  const capped: HandHistoryRecord[] = [];
  for (const sessionId of sessionIds.slice(0, MAX_ARCHIVED_SESSIONS)) {
    const bucket = grouped.get(sessionId);
    if (!bucket) {
      continue;
    }
    capped.push(...bucket.sort(sortNewestFirst).slice(0, MAX_ARCHIVED_HANDS_PER_SESSION));
    if (capped.length >= MAX_ARCHIVED_HANDS_TOTAL) {
      break;
    }
  }

  return capped.slice(0, MAX_ARCHIVED_HANDS_TOTAL);
}

function sortHandIdDesc(a: number, b: number): number {
  return b - a;
}

function buildReplayArchiveBootstrap(archive: ReplayArchive): ReplayArchive {
  const archivedSessionIds = archive.archivedSessionIds.slice(0, MAX_BOOTSTRAP_ARCHIVED_SESSIONS);
  const hands = capArchiveHands(archivedSessionIds, archive.hands).slice(0, MAX_BOOTSTRAP_ARCHIVED_HANDS);

  return {
    version: 1,
    updatedAt: archive.updatedAt,
    archivedSessionIds,
    hands,
  };
}

function normalizeReplayArchiveRecord(parsed: ReplayArchive): ReplayArchive {
  const archivedSessionIds = [...new Set(parsed.archivedSessionIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))].slice(
    0,
    MAX_ARCHIVED_SESSIONS,
  );
  const hands = capArchiveHands(archivedSessionIds, normalizeArchiveHands(parsed.hands));

  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
    archivedSessionIds,
    hands,
  };
}

function readReplayArchiveFromStorageKey(storageKey: string): ReplayArchive | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ReplayArchive;
    if (parsed.version !== 1 || !Array.isArray(parsed.hands) || !Array.isArray(parsed.archivedSessionIds)) {
      return null;
    }

    return normalizeReplayArchiveRecord(parsed);
  } catch {
    return null;
  }
}

function writeReplayArchiveBootstrap(archive: ReplayArchive): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(REPLAY_ARCHIVE_BOOTSTRAP_KEY, JSON.stringify(buildReplayArchiveBootstrap(archive)));
}

function supportsReplayArchiveIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openReplayArchiveDb(): Promise<IDBDatabase> {
  if (replayArchiveDbPromise) {
    return replayArchiveDbPromise;
  }

  replayArchiveDbPromise = new Promise((resolve, reject) => {
    if (!supportsReplayArchiveIndexedDb()) {
      reject(new Error('IndexedDB unavailable'));
      replayArchiveDbPromise = null;
      return;
    }

    const request = window.indexedDB.open(REPLAY_ARCHIVE_DB_NAME, REPLAY_ARCHIVE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPLAY_ARCHIVE_DB_STORE)) {
        db.createObjectStore(REPLAY_ARCHIVE_DB_STORE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        replayArchiveDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      replayArchiveDbPromise = null;
      reject(request.error ?? new Error('Failed to open replay archive IndexedDB'));
    };
  });

  return replayArchiveDbPromise;
}

async function readReplayArchiveFromIndexedDb(): Promise<ReplayArchive | null> {
  if (!supportsReplayArchiveIndexedDb()) {
    return null;
  }

  try {
    const db = await openReplayArchiveDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(REPLAY_ARCHIVE_DB_STORE, 'readonly');
      const store = tx.objectStore(REPLAY_ARCHIVE_DB_STORE);
      const request = store.get(REPLAY_ARCHIVE_DB_KEY);
      request.onsuccess = () => {
        const result = request.result;
        if (!result || typeof result !== 'object') {
          resolve(null);
          return;
        }
        const normalized = normalizeReplayArchiveData(result);
        resolve(normalized?.archive ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read replay archive from IndexedDB'));
    });
  } catch {
    return null;
  }
}

async function writeReplayArchiveToIndexedDb(archive: ReplayArchive): Promise<void> {
  if (!supportsReplayArchiveIndexedDb()) {
    return;
  }

  const db = await openReplayArchiveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REPLAY_ARCHIVE_DB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write replay archive to IndexedDB'));
    tx.objectStore(REPLAY_ARCHIVE_DB_STORE).put(archive, REPLAY_ARCHIVE_DB_KEY);
  });
}

async function clearReplayArchiveFromIndexedDb(): Promise<void> {
  if (!supportsReplayArchiveIndexedDb()) {
    return;
  }

  try {
    const db = await openReplayArchiveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(REPLAY_ARCHIVE_DB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear replay archive from IndexedDB'));
      tx.objectStore(REPLAY_ARCHIVE_DB_STORE).delete(REPLAY_ARCHIVE_DB_KEY);
    });
  } catch {
    // ignore storage cleanup failures; local fallback will still be cleared
  }
}

export function archiveReplaySession(archive: ReplayArchive, sessionId: string, hands: HandHistoryRecord[]): ReplayArchive {
  const normalizedIncoming = normalizeArchiveHands(hands, sessionId).slice(0, MAX_ARCHIVED_HANDS_PER_SESSION);
  if (!sessionId || normalizedIncoming.length === 0) {
    return archive;
  }

  const existingSessionIds = archive.archivedSessionIds.filter((id) => id !== sessionId);
  const nextSessionIds = [sessionId, ...existingSessionIds];
  const retainedExisting = archive.hands.filter((hand) => hand.sessionId !== sessionId);
  const nextHands = capArchiveHands(nextSessionIds, [...normalizedIncoming, ...retainedExisting]);

  return {
    version: 1,
    updatedAt: Date.now(),
    archivedSessionIds: nextSessionIds.slice(0, MAX_ARCHIVED_SESSIONS),
    hands: nextHands,
  };
}

export function mergeReplayArchives(base: ReplayArchive, incoming: ReplayArchive): ReplayArchive {
  const mergedHands = normalizeArchiveHands([...base.hands, ...incoming.hands]);
  const archivedSessionIds = deriveArchivedSessionIds(mergedHands, [...base.archivedSessionIds, ...incoming.archivedSessionIds]);

  return {
    version: 1,
    updatedAt: Date.now(),
    archivedSessionIds,
    hands: capArchiveHands(archivedSessionIds, mergedHands),
  };
}

export function pickReplayArchiveSessions(archive: ReplayArchive, sessionIds: string[]): ReplayArchive {
  const allowedSessionIds = new Set(sessionIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
  const preferredSessionIds = archive.archivedSessionIds.filter((sessionId) => allowedSessionIds.has(sessionId));
  const filteredHands = normalizeArchiveHands(archive.hands.filter((hand) => hand.sessionId && allowedSessionIds.has(hand.sessionId)));
  const archivedSessionIds = deriveArchivedSessionIds(filteredHands, preferredSessionIds);

  return {
    version: 1,
    updatedAt: archive.updatedAt,
    archivedSessionIds,
    hands: capArchiveHands(archivedSessionIds, filteredHands),
  };
}

export function buildReplayArchiveImportPreview(
  current: ReplayArchive,
  incoming: ReplayArchive,
  mode: ReplayArchiveImportMode,
): ReplayArchiveImportPreview {
  const result = mode === 'merge' ? mergeReplayArchives(current, incoming) : incoming;
  const currentSessionIds = [...new Set(current.archivedSessionIds)];
  const incomingSessionIds = [...new Set(incoming.archivedSessionIds)];
  const currentSessionIdSet = new Set(currentSessionIds);
  const incomingSessionIdSet = new Set(incomingSessionIds);
  const currentHandKeys = new Set(current.hands.map((hand) => getHandHistoryRecordKey(hand)));
  const currentHandsBySession = new Map<string, HandHistoryRecord[]>();
  const incomingHandsBySession = new Map<string, HandHistoryRecord[]>();
  const resultHandsBySession = new Map<string, HandHistoryRecord[]>();

  for (const hand of current.hands) {
    if (!hand.sessionId) {
      continue;
    }
    const bucket = currentHandsBySession.get(hand.sessionId);
    if (bucket) {
      bucket.push(hand);
    } else {
      currentHandsBySession.set(hand.sessionId, [hand]);
    }
  }

  for (const hand of incoming.hands) {
    if (!hand.sessionId) {
      continue;
    }
    const bucket = incomingHandsBySession.get(hand.sessionId);
    if (bucket) {
      bucket.push(hand);
    } else {
      incomingHandsBySession.set(hand.sessionId, [hand]);
    }
  }

  for (const hand of result.hands) {
    if (!hand.sessionId) {
      continue;
    }
    const bucket = resultHandsBySession.get(hand.sessionId);
    if (bucket) {
      bucket.push(hand);
    } else {
      resultHandsBySession.set(hand.sessionId, [hand]);
    }
  }

  const duplicateHandCount = incoming.hands.filter((hand) => currentHandKeys.has(getHandHistoryRecordKey(hand))).length;
  const overlappingSessionIds = incomingSessionIds.filter((sessionId) => currentSessionIdSet.has(sessionId));
  const newSessionIds = incomingSessionIds.filter((sessionId) => !currentSessionIdSet.has(sessionId));
  const removedSessionIds = mode === 'replace' ? currentSessionIds.filter((sessionId) => !incomingSessionIdSet.has(sessionId)) : [];
  const candidateSessionIds = mode === 'merge' ? [...new Set([...currentSessionIds, ...incomingSessionIds])] : incomingSessionIds;
  const resultSessionIdSet = new Set(result.archivedSessionIds);
  const overflowSessionIds = candidateSessionIds.filter((sessionId) => !resultSessionIdSet.has(sessionId));
  const sessionDiffs = incomingSessionIds.map((sessionId) => {
    const currentHands = currentHandsBySession.get(sessionId) ?? [];
    const incomingHands = incomingHandsBySession.get(sessionId) ?? [];
    const resultHands = resultHandsBySession.get(sessionId) ?? [];
    const duplicateHands = incomingHands.filter((hand) => currentHandKeys.has(getHandHistoryRecordKey(hand)));
    const duplicateCount = duplicateHands.length;
    const newHands = incomingHands.filter((hand) => !currentHandKeys.has(getHandHistoryRecordKey(hand)));
    const latestHand = incomingHands[0] ?? currentHands[0];

    return {
      sessionId,
      gameMode: latestHand?.gameMode ?? 'standard',
      sessionMode: latestHand?.sessionMode ?? 'cash',
      aiDifficulty: latestHand?.aiDifficulty ?? 'standard',
      endedAt: latestHand?.timestamp ?? current.updatedAt ?? incoming.updatedAt ?? Date.now(),
      currentHandCount: currentHands.length,
      incomingHandCount: incomingHands.length,
      duplicateHandCount: duplicateCount,
      newHandCount: Math.max(0, incomingHands.length - duplicateCount),
      resultHandCount: resultHands.length,
      keptInResult: resultSessionIdSet.has(sessionId),
      currentHandIds: currentHands.map((hand) => hand.handId).sort(sortHandIdDesc),
      incomingHandIds: incomingHands.map((hand) => hand.handId).sort(sortHandIdDesc),
      duplicateHandIds: duplicateHands.map((hand) => hand.handId).sort(sortHandIdDesc),
      newHandIds: newHands.map((hand) => hand.handId).sort(sortHandIdDesc),
      resultHandIds: resultHands.map((hand) => hand.handId).sort(sortHandIdDesc),
    };
  });

  return {
    mode,
    currentSessionCount: current.archivedSessionIds.length,
    currentHandCount: current.hands.length,
    incomingSessionCount: incoming.archivedSessionIds.length,
    incomingHandCount: incoming.hands.length,
    resultSessionCount: result.archivedSessionIds.length,
    resultHandCount: result.hands.length,
    duplicateHandCount,
    overlappingSessionIds,
    newSessionIds,
    removedSessionIds,
    overflowSessionIds,
    sessionDiffs,
  };
}

export function mergeReplayHistories(current: HandHistoryRecord[], archived: HandHistoryRecord[]): HandHistoryRecord[] {
  const merged = new Map<string, HandHistoryRecord>();

  for (const hand of current) {
    merged.set(getHandHistoryRecordKey(hand), hand);
  }
  for (const hand of archived) {
    const key = getHandHistoryRecordKey(hand);
    if (!merged.has(key)) {
      merged.set(key, hand);
    }
  }

  return [...merged.values()].sort(sortNewestFirst);
}

function normalizeReplayArchiveData(input: unknown): ReplayArchiveImportResult | null {
  if (!isObject(input)) {
    return null;
  }

  const rawHands = Array.isArray(input.hands) ? input.hands : null;
  const rawSessionIds = Array.isArray(input.archivedSessionIds) ? input.archivedSessionIds : [];
  if (!rawHands) {
    return null;
  }

  const validHands = rawHands.filter((hand): hand is HandHistoryRecord => isValidHandHistoryRecord(hand));
  if (rawHands.length > 0 && validHands.length === 0) {
    return null;
  }

  const normalizedHands = normalizeArchiveHands(validHands);
  const archivedSessionIds = deriveArchivedSessionIds(
    normalizedHands,
    rawSessionIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
  );

  const droppedHands = rawHands.length - validHands.length;
  const warnings: string[] = [];
  if (droppedHands > 0) {
    warnings.push(`已跳过 ${droppedHands} 条无效手牌记录。`);
  }

  return {
    archive: {
      version: 1,
      updatedAt: isFiniteNumber(input.updatedAt) ? input.updatedAt : Date.now(),
      archivedSessionIds,
      hands: capArchiveHands(archivedSessionIds, normalizedHands),
    },
    warning: warnings.join(' ') || undefined,
  };
}

export function parseReplayArchiveImport(raw: string): { result: ReplayArchiveImportResult | null; error?: string } {
  try {
    const parsed = JSON.parse(raw) as ReplayArchive | ReplayArchiveImportPayload;
    const direct = normalizeReplayArchiveData(parsed);
    if (direct) {
      return { result: direct };
    }

    const wrapped = isObject(parsed) ? normalizeReplayArchiveData(parsed.archive) : null;
    if (wrapped) {
      return { result: wrapped };
    }

    return {
      result: null,
      error: '导入失败：文件不是可识别的回放归档 JSON。',
    };
  } catch {
    return {
      result: null,
      error: '导入失败：JSON 格式不正确。',
    };
  }
}

export function summarizeReplayArchive(archive: ReplayArchive): ReplayArchiveSummary {
  return {
    sessionCount: archive.archivedSessionIds.length,
    handCount: archive.hands.length,
    updatedAt: archive.updatedAt || null,
  };
}

export function exportReplayArchive(archive: ReplayArchive): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    archive,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `holdem-replay-archive-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function writeReplayArchive(archive: ReplayArchive): void {
  if (typeof window === 'undefined') {
    return;
  }

  writeReplayArchiveBootstrap(archive);

  if (!supportsReplayArchiveIndexedDb()) {
    window.localStorage.setItem(REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify(archive));
    return;
  }

  window.localStorage.removeItem(REPLAY_ARCHIVE_STORAGE_KEY);
  void writeReplayArchiveToIndexedDb(archive).catch(() => {
    window.localStorage.setItem(REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify(archive));
  });
}

export function readReplayArchive(): ReplayArchive {
  const bootstrap = readReplayArchiveFromStorageKey(REPLAY_ARCHIVE_BOOTSTRAP_KEY);
  if (bootstrap) {
    return bootstrap;
  }

  const legacy = readReplayArchiveFromStorageKey(REPLAY_ARCHIVE_STORAGE_KEY);
  return legacy ?? createEmptyReplayArchive();
}

export async function loadReplayArchive(): Promise<ReplayArchive> {
  if (typeof window === 'undefined') {
    return createEmptyReplayArchive();
  }

  const indexedDbArchive = await readReplayArchiveFromIndexedDb();
  const legacyArchive = readReplayArchiveFromStorageKey(REPLAY_ARCHIVE_STORAGE_KEY);

  if (legacyArchive && (!indexedDbArchive || legacyArchive.updatedAt >= indexedDbArchive.updatedAt)) {
    writeReplayArchiveBootstrap(legacyArchive);
    if (supportsReplayArchiveIndexedDb()) {
      await writeReplayArchiveToIndexedDb(legacyArchive);
    }
    window.localStorage.removeItem(REPLAY_ARCHIVE_STORAGE_KEY);
    return legacyArchive;
  }

  if (indexedDbArchive) {
    writeReplayArchiveBootstrap(indexedDbArchive);
    window.localStorage.removeItem(REPLAY_ARCHIVE_STORAGE_KEY);
    return indexedDbArchive;
  }

  return readReplayArchive();
}

export function clearReplayArchive(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(REPLAY_ARCHIVE_BOOTSTRAP_KEY);
  window.localStorage.removeItem(REPLAY_ARCHIVE_STORAGE_KEY);
  void clearReplayArchiveFromIndexedDb();
}
