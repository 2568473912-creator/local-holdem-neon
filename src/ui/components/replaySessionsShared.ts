import type { ChangeEvent, MutableRefObject, ReactNode } from 'react';
import type { GameMode } from '../../types/cards';
import type { CareerProfile } from '../../types/profile';
import type { ReplayOpenOptions } from '../../types/replay';
import type { ReplayArchive, ReplayArchiveImportMode, ReplayArchiveImportPreview, ReplayArchiveSummary } from '../../state/replayArchive';
import type {
  ReplaySessionGroup,
  ReplaySessionHandAnalysis,
  ReplaySessionHandFilter,
  ReplaySessionHandInsight,
  ReplaySessionSummary,
} from '../../replay/sessionHistory';
import type {
  ComparedSessionDiffState,
  ComparedSessionHandState,
  LastViewedImportHandState,
  PendingReplayImportState,
  PinnedImportHandState,
  RecentViewedImportHandState,
} from './replayCenterShared';

export interface PendingReplayImportSessionView {
  sessionId: string;
  handCount: number;
  endedAt: number;
  mode: GameMode;
  sessionMode: 'cash' | 'tournament';
  aiDifficulty: 'conservative' | 'standard' | 'aggressive';
  selected: boolean;
}

export interface ReplaySessionArchivePanelProps {
  archiveImportRef: MutableRefObject<HTMLInputElement | null>;
  replayArchiveSummary: ReplayArchiveSummary;
  currentSessionId: string | null;
  pendingReplayImport: PendingReplayImportState | null;
  pendingReplayImportPreview: ReplayArchiveImportPreview | null;
  selectedReplayImportArchive: ReplayArchive | null;
  pendingReplayImportSessions: PendingReplayImportSessionView[];
  lastViewedImportHand: LastViewedImportHandState | null;
  recentViewedImportHands: RecentViewedImportHandState[];
  pinnedImportHands: PinnedImportHandState[];
  replaySessionSummaries: ReplaySessionSummary[];
  selectedSessionGroup: ReplaySessionGroup | null;
  selectedSessionAnalysis: ReplaySessionHandAnalysis | null;
  selectedSessionFilteredHands: ReplaySessionHandInsight[];
  selectedSessionHandFilter: ReplaySessionHandFilter;
  visibleComparedSessionHands: ComparedSessionHandState[];
  comparedSessionDiffs: ComparedSessionDiffState;
  compareHighlightDiffs: boolean;
  previewedSessionJumpKey: string | null;
  archiveFeedback: { tone: 'neutral' | 'error'; message: string } | null;
  renderHandIdPills: (sessionId: string, handIds: number[], tone: 'cyan' | 'gold' | 'steel') => ReactNode;
  onArchiveImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportReplayArchiveClick: (mode: ReplayArchiveImportMode) => void;
  onExportReplayArchive: () => void;
  onClearReplayArchive: () => void;
  onCancelReplayImport: () => void;
  onConfirmReplayImport: () => void;
  onToggleReplayImportSession: (sessionId: string) => void;
  onSelectAllReplayImportSessions: () => void;
  onClearReplayImportSessions: () => void;
  onOpenImportHandReplay: (item: RecentViewedImportHandState) => void;
  onTogglePinnedImportHand: (item: PinnedImportHandState) => void;
  onClearPinnedImportHands: () => void;
  onClearRecentImportHands: () => void;
  onSelectSessionKey: (sessionKey: string) => void;
  onSelectedSessionHandFilterChange: (filter: ReplaySessionHandFilter) => void;
  onSwitchToHands: () => void;
  onCompareHighlightDiffsChange: (value: boolean) => void;
  onClearComparedSessionHands: () => void;
  onRemoveComparedSessionHand: (handKey: string) => void;
  onPreviewSessionJumpKeyChange: (key: string | null) => void;
  onOpenReplay: (handKey: string, options?: ReplayOpenOptions) => void;
  onToggleComparedSessionHand: (sessionKey: string, item: ReplaySessionHandInsight) => void;
  onReady?: () => void;
}

export interface ReplayCareerPanelProps {
  careerImportRef: MutableRefObject<HTMLInputElement | null>;
  careerProfile: CareerProfile;
  careerModeBreakdown: Array<{
    mode: GameMode;
    sessions: number;
    hands: number;
    profit: number;
  }>;
  recentDifficultyBreakdown: {
    conservative: number;
    standard: number;
    aggressive: number;
  };
  careerFeedback: { tone: 'neutral' | 'error'; message: string } | null;
  onCareerImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportCareerClick: () => void;
  onExportCareer: () => void;
  onClearCareer: () => void;
  onReady?: () => void;
}

export interface ReplaySessionsPanelProps extends ReplaySessionArchivePanelProps, ReplayCareerPanelProps {
  onReady?: () => void;
  onArchiveReady?: () => void;
  onCareerReady?: () => void;
}
