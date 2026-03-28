import type { HandHistoryRecord } from '../types/replay';

export function getHandHistoryRecordKey(record: Pick<HandHistoryRecord, 'sessionId' | 'handId' | 'timestamp'>): string {
  return `${record.sessionId ?? 'legacy'}:${record.handId}:${record.timestamp}`;
}
