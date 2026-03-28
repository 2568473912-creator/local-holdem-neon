import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './ui/styles/theme.css';
import { createSoundBus } from './audio/soundBus';
import { getAiPackOption } from './content/aiPacks';
import { getTournamentPrizeLines } from './engine/tournamentPrize';
import { t, type AppLanguage } from './i18n';
import { LanguageProvider } from './i18n/LanguageProvider';
import { audioLevelLabel, cycleAudioLevel, readAudioPreferences, writeAudioPreferences, type AudioLevel } from './state/audioPreferences';
import { cycleMotionLevel, motionLevelLabel, readMotionPreferences, writeMotionPreferences, type MotionLevel } from './state/motionPreferences';
import {
  cycleOwnedTableTheme,
  purchaseTableTheme,
  readThemePreferences,
  selectTableTheme,
  writeThemePreferences,
  type ThemePreferences,
  type ThemePurchaseResult,
} from './state/themePreferences';
import {
  purchaseHumanPortrait,
  readPortraitPreferences,
  selectHumanPortrait,
  writePortraitPreferences,
  type PortraitPreferences,
  type PortraitPurchaseResult,
} from './state/portraitPreferences';
import {
  purchaseCardSkin,
  readCardSkinPreferences,
  selectCardSkin,
  writeCardSkinPreferences,
  type CardSkinPreferences,
  type CardSkinPurchaseResult,
} from './state/cardSkinPreferences';
import {
  purchaseEffectSkin,
  readEffectSkinPreferences,
  selectEffectSkin,
  writeEffectSkinPreferences,
  type EffectSkinPreferences,
  type EffectSkinPurchaseResult,
} from './state/effectSkinPreferences';
import {
  purchaseAIPack,
  readAIPackPreferences,
  selectAIPack,
  writeAIPackPreferences,
  type AIPackPreferences,
  type AIPackPurchaseResult,
} from './state/aiPackPreferences';
import { readLanguagePreference, writeLanguagePreference } from './state/languagePreferences';
import { readPlatformRuntimeState, watchPlatformRuntimeState, type PlatformRuntimeState } from './platform/runtime';
import { useGameController } from './state/useGameController';
import { useDouDizhuController } from './state/useDouDizhuController';
import { useGuandanController } from './state/useGuandanController';
import { getTournamentLevel, getUpcomingTournamentLevels } from './engine/tournamentStructure';
import { AI_PACK_UNLOCK_COSTS, type AIPackKey } from './types/aiPack';
import { HUMAN_PORTRAIT_UNLOCK_COSTS, type HumanPortraitKey } from './types/portrait';
import { TABLE_THEME_UNLOCK_COSTS, type TableThemeKey } from './types/theme';
import { CARD_SKIN_UNLOCK_COSTS, type CardSkinKey } from './types/cardSkin';
import { EFFECT_SKIN_UNLOCK_COSTS, type EffectSkinKey } from './types/effectSkin';
import type { GameConfig } from './types/game';
import { getTableThemeOption } from './ui/tableThemes';
import { LegalOverlay, type LegalTab } from './ui/components/LegalOverlay';
import { LanguageSwitcher } from './ui/components/LanguageSwitcher';
import { MenuShopOverlay } from './ui/components/MenuShopOverlay';

const MainMenu = lazy(() => import('./ui/components/MainMenu').then((module) => ({ default: module.MainMenu })));
const GameHubMenu = lazy(() => import('./ui/components/GameHubMenu').then((module) => ({ default: module.GameHubMenu })));
const DouDizhuMenu = lazy(() => import('./ui/components/DouDizhuMenu').then((module) => ({ default: module.DouDizhuMenu })));
const DouDizhuTable = lazy(() => import('./ui/components/DouDizhuTable').then((module) => ({ default: module.DouDizhuTable })));
const GuandanMenu = lazy(() => import('./ui/components/GuandanMenu').then((module) => ({ default: module.GuandanMenu })));
const GuandanTable = lazy(() => import('./ui/components/GuandanTable').then((module) => ({ default: module.GuandanTable })));
const ReplayCenter = lazy(() => import('./ui/components/ReplayCenter').then((module) => ({ default: module.ReplayCenter })));
const ReplayViewer = lazy(() => import('./ui/components/ReplayViewer').then((module) => ({ default: module.ReplayViewer })));
const TableScene = lazy(() => import('./ui/components/TableScene').then((module) => ({ default: module.TableScene })));
const TopHud = lazy(() => import('./ui/components/TopHud').then((module) => ({ default: module.TopHud })));

function ScreenLoader({ label, language }: { label: string; language: AppLanguage }) {
  return (
    <div className="screen-loader glass-panel" role="status" aria-live="polite">
      <div className="screen-loader-ring" />
      <strong>{label}</strong>
      <span>{t(language, 'common.loading')}</span>
    </div>
  );
}

declare global {
  interface NeonDebugApi {
    prepareHoldemHistoryAudit?: (options?: { hands?: number; openHistory?: boolean }) => Promise<{
      generatedHands: number;
      screen: string;
    }>;
  }

  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __neonDebug?: NeonDebugApi;
  }
}

function IpadSupportLayer({ platform, language }: { platform: PlatformRuntimeState; language: AppLanguage }) {
  if (!platform.isIpadLike || !platform.isPortrait) {
    return null;
  }

  return (
    <div className="ipad-orientation-guard glass-panel">
      <strong>{t(language, 'app.orientationTitle')}</strong>
      <span>{t(language, 'app.orientationBody')}</span>
    </div>
  );
}

function App() {
  const [menuGame, setMenuGame] = useState<'hub' | 'holdem' | 'doudizhu' | 'guandan'>('hub');
  const [portraitPreferences, setPortraitPreferences] = useState<PortraitPreferences>(() => readPortraitPreferences());
  const [cardSkinPreferences, setCardSkinPreferences] = useState<CardSkinPreferences>(() => readCardSkinPreferences());
  const [effectSkinPreferences, setEffectSkinPreferences] = useState<EffectSkinPreferences>(() => readEffectSkinPreferences());
  const [aiPackPreferences, setAIPackPreferences] = useState<AIPackPreferences>(() => readAIPackPreferences());
  const humanPortraitKey = portraitPreferences.humanPortraitKey;
  const cardSkinKey = cardSkinPreferences.cardSkinKey;
  const effectSkinKey = effectSkinPreferences.effectSkinKey;
  const aiPackKey = aiPackPreferences.aiPackKey;
  const [platformState, setPlatformState] = useState<PlatformRuntimeState>(() => readPlatformRuntimeState());
  const [language, setLanguage] = useState<AppLanguage>(() => readLanguagePreference());
  const [legalOverlayOpen, setLegalOverlayOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('privacy');
  const [shopOpen, setShopOpen] = useState(false);
  const [shopInstance, setShopInstance] = useState(0);
  const devPointsInjectedRef = useRef(false);
  const {
    state,
    currentReplayRecord,
    replayHistory,
    replayArchive,
    replayArchiveSummary,
    humanActionOptions,
    autoAction,
    careerProfile,
    savedSessionMeta,
    startGame,
    resumeSavedSession,
    clearSavedSessionEntry,
    humanAction,
    nextHand,
    restartSession,
    backToMenu,
    togglePause,
    openHistory,
    openTable,
    openReplay,
    replayStep,
    replayJumpToStage,
    replaySetStep,
    replayToggleAutoplay,
    setAutoAction,
    setAIDifficulty,
    clearCareerArchive,
    clearReplayArchive,
    importCareerArchive,
    importReplayArchive,
  } = useGameController({ defaultHumanPortraitKey: humanPortraitKey });
  const {
    state: ddzState,
    view: ddzView,
    startGame: startDouDizhuGame,
    backToMenu: backToDouDizhuMenu,
    restartSession: restartDouDizhuSession,
    nextRound: nextDouDizhuRound,
    togglePause: toggleDouDizhuPause,
    humanBid,
    humanToggleCard,
    humanSelectPattern,
    humanClearSelection,
    humanHint,
    humanPlay,
    humanPass,
    setAIDifficulty: setDouDizhuAIDifficulty,
    setTrusteeMode: setDouDizhuTrusteeMode,
    openHistoryViewer: openDouDizhuHistoryViewer,
    closeHistoryViewer: closeDouDizhuHistoryViewer,
    selectHistoryViewerRound: selectDouDizhuHistoryViewerRound,
    advanceTime: advanceDouDizhuTime,
  } = useDouDizhuController({ defaultHumanPortraitKey: humanPortraitKey });
  const {
    state: gdState,
    view: gdView,
    startGame: startGuandanGame,
    backToMenu: backToGuandanMenu,
    restartSession: restartGuandanSession,
    nextRound: nextGuandanRound,
    togglePause: toggleGuandanPause,
    humanToggleCard: humanToggleGuandanCard,
    humanClearSelection: humanClearGuandanSelection,
    humanHint: humanGuandanHint,
    humanPlay: humanGuandanPlay,
    humanPass: humanGuandanPass,
    setAIDifficulty: setGuandanAIDifficulty,
    setTrusteeMode: setGuandanTrusteeMode,
    advanceTime: advanceGuandanTime,
  } = useGuandanController({ defaultHumanPortraitKey: humanPortraitKey });
  const [audioLevel, setAudioLevel] = useState<AudioLevel>(() => readAudioPreferences().level);
  const [motionLevel, setMotionLevel] = useState<MotionLevel>(() => readMotionPreferences().level);
  const [themePreferences, setThemePreferences] = useState<ThemePreferences>(() => readThemePreferences());
  const [historyPerf, setHistoryPerf] = useState<Record<string, unknown> | null>(null);
  const stateRef = useRef(state);
  const humanActionOptionsRef = useRef(humanActionOptions);
  const tableThemeKey = themePreferences.tableThemeKey;
  const shopAvailablePoints = useMemo(
    () =>
      Math.max(
        0,
        careerProfile.tournamentPointsEarned -
          portraitPreferences.tournamentPointsSpent -
          themePreferences.tournamentPointsSpent -
          cardSkinPreferences.tournamentPointsSpent -
          effectSkinPreferences.tournamentPointsSpent -
          aiPackPreferences.tournamentPointsSpent,
      ),
    [
      aiPackPreferences.tournamentPointsSpent,
      cardSkinPreferences.tournamentPointsSpent,
      careerProfile.tournamentPointsEarned,
      effectSkinPreferences.tournamentPointsSpent,
      portraitPreferences.tournamentPointsSpent,
      themePreferences.tournamentPointsSpent,
    ],
  );
  const soundBusRef = useRef(createSoundBus(audioLevel));
  const ddzSoundSnapshotRef = useRef<{
    trusteeMode: string;
    phase: string | null;
    eventKey: string | null;
    winnerId: string | null;
  } | null>(null);
  const soundSnapshotRef = useRef<{
    screen: string;
    handId: number | null;
    stage: string | null;
    boardCount: number;
    totalPot: number;
    activePlayerId: string | null;
    heroWon: boolean;
    allInCount: number;
    eliminatedCount: number;
  } | null>(null);

  const withIpadLayer = (content: ReactNode) => (
    <LanguageProvider language={language}>
      <IpadSupportLayer platform={platformState} language={language} />
      {content}
    </LanguageProvider>
  );

  const openLegalOverlay = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalOverlayOpen(true);
  };

  const openShopOverlay = () => {
    setShopInstance((prev) => prev + 1);
    setShopOpen(true);
  };

  const closeShopOverlay = () => {
    setShopOpen(false);
  };

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    humanActionOptionsRef.current = humanActionOptions;
  }, [humanActionOptions]);

  const withMenuLayer = (content: ReactNode) =>
    withIpadLayer(
      <>
        {content}
        {!platformState.isIpadLike ? (
          <div className={`legal-entry-dock glass-panel ${platformState.isIpadLike ? 'ipad-utility-dock' : ''}`}>
            <LanguageSwitcher language={language} onChange={setLanguage} compact label={t(language, 'common.language')} />
            <button className="btn mini primary legal-entry-button" type="button" onClick={openShopOverlay}>
              {t(language, 'common.shop')}
            </button>
            <button className="btn mini primary legal-entry-button" type="button" onClick={() => openLegalOverlay('privacy')}>
              {t(language, 'common.appHelp')}
            </button>
          </div>
        ) : null}
        <MenuShopOverlay
          key={shopInstance}
          open={shopOpen}
          onClose={closeShopOverlay}
          availablePoints={shopAvailablePoints}
          totalEarnedPoints={careerProfile.tournamentPointsEarned}
          portraitPointsSpent={portraitPreferences.tournamentPointsSpent}
          cardSkinPointsSpent={cardSkinPreferences.tournamentPointsSpent}
          effectSkinPointsSpent={effectSkinPreferences.tournamentPointsSpent}
          themePointsSpent={themePreferences.tournamentPointsSpent}
          aiPackPointsSpent={aiPackPreferences.tournamentPointsSpent}
          humanPortraitKey={humanPortraitKey}
          portraitOwnedKeys={portraitPreferences.ownedPortraitKeys}
          onChangeHumanPortraitKey={handleSelectHumanPortraitKey}
          onPurchaseHumanPortrait={handlePurchaseHumanPortrait}
          cardSkinKey={cardSkinKey}
          cardSkinOwnedKeys={cardSkinPreferences.ownedCardSkinKeys}
          onChangeCardSkinKey={handleSelectCardSkinKey}
          onPurchaseCardSkin={handlePurchaseCardSkin}
          effectSkinKey={effectSkinKey}
          effectSkinOwnedKeys={effectSkinPreferences.ownedEffectSkinKeys}
          onChangeEffectSkinKey={handleSelectEffectSkinKey}
          onPurchaseEffectSkin={handlePurchaseEffectSkin}
          tableThemeKey={tableThemeKey}
          themeOwnedKeys={themePreferences.ownedThemeKeys}
          onChangeTableThemeKey={handleSelectTableTheme}
          onPurchaseTableTheme={handlePurchaseTableTheme}
          aiPackKey={aiPackKey}
          aiPackOwnedKeys={aiPackPreferences.ownedAiPackKeys}
          onChangeAiPackKey={handleSelectAiPackKey}
          onPurchaseAiPack={handlePurchaseAiPack}
          language={language}
        />
        <LegalOverlay language={language} open={legalOverlayOpen} tab={legalTab} onClose={() => setLegalOverlayOpen(false)} onChangeTab={setLegalTab} />
      </>,
    );

  useEffect(() => watchPlatformRuntimeState(setPlatformState), []);

  useEffect(() => {
    writeLanguagePreference(language);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      const localizedTitle =
        state.screen === 'menu'
          ? menuGame === 'holdem'
            ? t(language, 'main.title')
            : menuGame === 'doudizhu'
              ? t(language, 'hub.doudizhu.title')
              : menuGame === 'guandan'
                ? t(language, 'hub.guandan.title')
                : t(language, 'hub.title')
          : t(language, 'hub.holdem.title');
      document.title = localizedTitle;
    }
  }, [language, menuGame, state.screen]);

  useEffect(() => {
    if (devPointsInjectedRef.current || typeof window === 'undefined') {
      return;
    }

    const isLocalDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isLocalDevHost) {
      devPointsInjectedRef.current = true;
      return;
    }

    if (careerProfile.tournamentPointsEarned >= 10000) {
      devPointsInjectedRef.current = true;
      return;
    }

    importCareerArchive(
      {
        ...careerProfile,
        tournamentPointsEarned: 10000,
        lastUpdatedAt: Date.now(),
      },
      language === 'zh-CN' ? '测试服已补充 10000 积分' : `Dev build credited 10000 tournament points`,
    );
    devPointsInjectedRef.current = true;
  }, [careerProfile, importCareerArchive, language]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isLocalDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalDevHost) {
      return;
    }

    const waitFor = async (predicate: () => boolean, timeoutMs = 30000, intervalMs = 50): Promise<void> => {
      const startedAt = Date.now();
      while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error('Timed out while preparing holdem history audit');
        }
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
      }
    };

    const prepareHoldemHistoryAudit = async ({
      hands = 2,
      openHistory: shouldOpenHistory = true,
    }: { hands?: number; openHistory?: boolean } = {}) => {
      const desiredHands = Math.max(1, Math.floor(hands));
      const auditConfig: GameConfig = {
        mode: 'standard',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 5000,
        smallBlind: 20,
        bigBlind: 40,
        blindLevel: 1,
        blindUpEveryHands: 8,
        fastMode: false,
        aiDifficulty: 'standard',
        straddleMode: 'off',
        humanPortraitKey,
        aiPackKey,
        language,
      };

      const current = stateRef.current;
      if (current.screen !== 'table' || !current.runtime) {
        setMenuGame('holdem');
        startGame(auditConfig);
        await waitFor(() => stateRef.current.screen === 'table' && Boolean(stateRef.current.runtime));
      }

      let completedHands = stateRef.current.history.length;
      while (completedHands < desiredHands) {
        await waitFor(
          () =>
            stateRef.current.screen === 'table' &&
            (stateRef.current.runtime?.table.stage === 'complete' ||
              humanActionOptionsRef.current.some((option) => option.type === 'fold' && option.enabled)),
        );
        if (stateRef.current.runtime?.table.stage !== 'complete') {
          humanAction({ type: 'fold' });
          await waitFor(() => stateRef.current.runtime?.table.stage === 'complete');
        }
        completedHands = stateRef.current.history.length;
        if (completedHands < desiredHands) {
          const nextHandId = (stateRef.current.runtime?.table.handId ?? completedHands) + 1;
          nextHand();
          await waitFor(
            () =>
              stateRef.current.screen === 'table' &&
              stateRef.current.runtime?.table.handId === nextHandId &&
              stateRef.current.runtime?.table.stage !== 'complete',
          );
        }
      }

      if (shouldOpenHistory) {
        openHistory();
        await waitFor(() => stateRef.current.screen === 'history', 10000);
      }

      return {
        generatedHands: stateRef.current.history.length,
        screen: stateRef.current.screen,
      };
    };

    window.__neonDebug = {
      prepareHoldemHistoryAudit,
    };

    return () => {
      if (window.__neonDebug?.prepareHoldemHistoryAudit === prepareHoldemHistoryAudit) {
        delete window.__neonDebug;
      }
    };
  }, [aiPackKey, humanAction, humanPortraitKey, humanActionOptions, language, nextHand, openHistory, startGame]);

  useEffect(() => {
    writeAudioPreferences({ level: audioLevel });
    soundBusRef.current.setLevel(audioLevel);
  }, [audioLevel]);

  useEffect(() => {
    writePortraitPreferences(portraitPreferences);
  }, [portraitPreferences]);

  useEffect(() => {
    writeCardSkinPreferences(cardSkinPreferences);
  }, [cardSkinPreferences]);

  useEffect(() => {
    writeEffectSkinPreferences(effectSkinPreferences);
  }, [effectSkinPreferences]);

  useEffect(() => {
    writeAIPackPreferences(aiPackPreferences);
  }, [aiPackPreferences]);

  const handleSelectHumanPortraitKey = (key: HumanPortraitKey) => {
    setPortraitPreferences((prev) => selectHumanPortrait(prev, key));
  };

  const handlePurchaseHumanPortrait = (key: HumanPortraitKey): PortraitPurchaseResult => {
    const result = purchaseHumanPortrait(portraitPreferences, shopAvailablePoints, key, HUMAN_PORTRAIT_UNLOCK_COSTS[key]);
    setPortraitPreferences(result.preferences);
    return result;
  };

  const handleSelectCardSkinKey = (key: CardSkinKey) => {
    setCardSkinPreferences((prev) => selectCardSkin(prev, key));
  };

  const handlePurchaseCardSkin = (key: CardSkinKey): CardSkinPurchaseResult => {
    const result = purchaseCardSkin(cardSkinPreferences, shopAvailablePoints, key, CARD_SKIN_UNLOCK_COSTS[key]);
    setCardSkinPreferences(result.preferences);
    return result;
  };

  const handleSelectEffectSkinKey = (key: EffectSkinKey) => {
    setEffectSkinPreferences((prev) => selectEffectSkin(prev, key));
  };

  const handlePurchaseEffectSkin = (key: EffectSkinKey): EffectSkinPurchaseResult => {
    const result = purchaseEffectSkin(effectSkinPreferences, shopAvailablePoints, key, EFFECT_SKIN_UNLOCK_COSTS[key]);
    setEffectSkinPreferences(result.preferences);
    return result;
  };

  const handleSelectAiPackKey = (key: AIPackKey) => {
    setAIPackPreferences((prev) => selectAIPack(prev, key));
  };

  const handlePurchaseAiPack = (key: AIPackKey): AIPackPurchaseResult => {
    const result = purchaseAIPack(aiPackPreferences, shopAvailablePoints, key, AI_PACK_UNLOCK_COSTS[key]);
    setAIPackPreferences(result.preferences);
    return result;
  };

  const handleSelectTableTheme = (key: TableThemeKey) => {
    setThemePreferences((prev) => selectTableTheme(prev, key));
  };

  const handlePurchaseTableTheme = (key: TableThemeKey): ThemePurchaseResult => {
    const result = purchaseTableTheme(themePreferences, shopAvailablePoints, key, TABLE_THEME_UNLOCK_COSTS[key]);
    setThemePreferences(result.preferences);
    return result;
  };

  const startHoldemGame = (config: GameConfig) => {
    setMenuGame('holdem');
    startGame({
      ...config,
      humanPortraitKey,
      aiPackKey,
    });
  };

  useEffect(() => {
    writeThemePreferences(themePreferences);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.tableTheme = tableThemeKey;
    }
  }, [tableThemeKey, themePreferences]);

  useEffect(() => {
    writeMotionPreferences({ level: motionLevel });
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.motionLevel = motionLevel;
    }
  }, [motionLevel]);

  useEffect(() => {
    if (typeof window === 'undefined' || audioLevel === 'off') {
      return;
    }

    const unlockSound = () => {
      soundBusRef.current.prime();
    };

    window.addEventListener('pointerdown', unlockSound, { passive: true });
    window.addEventListener('keydown', unlockSound);
    return () => {
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, [audioLevel]);

  useEffect(() => {
    const current = {
      screen: state.screen,
      handId: state.runtime?.table.handId ?? null,
      stage: state.runtime?.table.stage ?? null,
      boardCount: state.runtime?.table.board.length ?? 0,
      totalPot: state.runtime?.table.totalPot ?? 0,
      activePlayerId: state.runtime?.table.activePlayerId ?? null,
      heroWon: state.runtime?.table.winners.includes('P0') ?? false,
      allInCount: state.runtime?.table.players.filter((player) => player.allIn && !player.eliminated).length ?? 0,
      eliminatedCount: state.runtime?.table.players.filter((player) => player.eliminated).length ?? 0,
    };
    const previous = soundSnapshotRef.current;

    if (previous) {
      if (previous.screen !== current.screen && (current.screen === 'history' || current.screen === 'replay')) {
        soundBusRef.current.play('panelOpen');
      }
      if (current.handId !== null && previous.handId !== null && current.handId !== previous.handId) {
        soundBusRef.current.play('handStart');
      }
      if (current.boardCount > previous.boardCount) {
        soundBusRef.current.play('boardReveal');
      }
      if (previous.stage !== 'showdown' && current.stage === 'showdown') {
        soundBusRef.current.play('showdown');
      }
      if (current.totalPot > previous.totalPot && current.stage !== 'complete') {
        soundBusRef.current.play('chipCommit');
      }
      if (current.allInCount > previous.allInCount && current.stage !== 'complete') {
        soundBusRef.current.play('allIn');
      }
      if (current.eliminatedCount > previous.eliminatedCount) {
        soundBusRef.current.play('elimination');
      }
      if (previous.activePlayerId !== 'P0' && current.activePlayerId === 'P0' && current.stage !== 'complete' && current.screen === 'table' && !state.paused) {
        soundBusRef.current.play('heroTurn');
      }
      if (previous.stage !== 'complete' && current.stage === 'complete') {
        soundBusRef.current.play(current.heroWon ? 'heroWin' : 'heroLose');
      }
    }

    soundSnapshotRef.current = current;
  }, [state.paused, state.runtime, state.screen]);

  useEffect(() => {
    if (ddzState.screen !== 'table' || !ddzState.runtime) {
      ddzSoundSnapshotRef.current = null;
      return;
    }

    const latestSpecialEvent = [...ddzState.runtime.multiplierBreakdown.events].reverse().find((event) => event.kind !== 'bid') ?? null;
    const current = {
      trusteeMode: ddzState.trusteeMode,
      phase: ddzState.runtime.phase,
      eventKey: latestSpecialEvent ? `${latestSpecialEvent.kind}-${ddzState.runtime.multiplierBreakdown.events.length}-${ddzState.runtime.round}` : null,
      winnerId: ddzState.runtime.winnerId,
    };
    const previous = ddzSoundSnapshotRef.current;

    if (previous) {
      if (current.eventKey && current.eventKey !== previous.eventKey && latestSpecialEvent) {
        soundBusRef.current.play(
          latestSpecialEvent.kind === 'rocket' ? 'ddzRocket' : latestSpecialEvent.kind === 'spring' ? 'ddzSpring' : 'ddzBomb',
        );
      }
      if (previous.phase !== 'settlement' && current.phase === 'settlement') {
        soundBusRef.current.play(ddzState.runtime.winnerId === 'P0' ? 'heroWin' : 'heroLose');
      }
      if (previous.trusteeMode === 'off' && current.trusteeMode !== 'off') {
        soundBusRef.current.play('panelOpen');
      }
    }

    ddzSoundSnapshotRef.current = current;
  }, [ddzState.runtime, ddzState.screen, ddzState.trusteeMode]);

  useEffect(() => {
    window.render_game_to_text = () => {
      const payload: Record<string, unknown> = {
        screen: state.screen,
        menu: {
          page: menuGame,
        },
        note: '坐标系说明：桌面中心为视觉原点，座位按顺时针环绕布局。',
        device: {
          ipadLike: platformState.isIpadLike,
          standalone: platformState.isStandalone,
          portrait: platformState.isPortrait,
          touch: platformState.isTouch,
        },
        language: {
          key: language,
        },
      };

      if (gdState.screen === 'table' && gdState.runtime) {
        payload.screen = 'guandan';
        payload.guandan = {
          phase: gdState.runtime.phase,
          round: gdState.runtime.round,
          dealSeed: gdState.runtime.dealSeed,
          trusteeMode: gdState.trusteeMode,
          currentPlayerId: gdState.runtime.currentPlayerId,
          trick: {
            playerId: gdState.runtime.trick.playerId,
            pattern: gdState.runtime.trick.pattern?.description ?? null,
            passCount: gdState.runtime.trick.passCount,
          },
          tableCards: gdState.runtime.tableDisplay.cards.map((card) => card.code),
          victoryType: gdState.runtime.victoryType,
          victoryLabel: gdState.runtime.victoryLabel,
          specialBurst: gdState.runtime.specialBurst
            ? {
                kind: gdState.runtime.specialBurst.kind,
                label: gdState.runtime.specialBurst.label,
              }
            : null,
          specialHistory: gdState.runtime.specialHistory.map((entry) => ({
            kind: entry.kind,
            label: entry.label,
          })),
          teamLevels: gdState.runtime.teamLevels,
          finishOrder: gdState.runtime.finishOrder,
          players: gdState.runtime.players.map((player) => ({
            id: player.id,
            name: player.name,
            team: player.team,
            handCount: player.hand.length,
            finishOrder: player.finishOrder,
            score: player.score,
            lastAction: player.lastAction,
            hand: player.isHuman ? player.hand.map((card) => card.code) : undefined,
          })),
          selectedCards: gdState.runtime.selectedCardIds,
          recentHistory: gdState.history.slice(0, 5).map((entry) => ({
            round: entry.round,
            dealSeed: entry.dealSeed,
            winningTeam: entry.winningTeam,
            levelDelta: entry.levelDelta,
            finishOrder: entry.finishOrder,
            victoryType: entry.victoryType,
            victoryLabel: entry.victoryLabel,
            specials: entry.specials.map((special) => special.kind),
          })),
        };
      } else if (ddzState.screen === 'table' && ddzState.runtime) {
        const selectedHistoryEntry =
          (ddzState.historyViewerRound !== null ? ddzState.history.find((entry) => entry.round === ddzState.historyViewerRound) : null) ?? ddzState.history[0] ?? null;
        payload.screen = 'doudizhu';
        payload.doudizhu = {
          phase: ddzState.runtime.phase,
          round: ddzState.runtime.round,
          dealSeed: ddzState.runtime.dealSeed,
          trusteeMode: ddzState.trusteeMode,
          historyViewerOpen: ddzState.historyViewerOpen,
          historyViewerRound: ddzState.historyViewerRound,
          currentPlayerId: ddzState.runtime.currentPlayerId,
          landlordId: ddzState.runtime.landlordId,
          baseBid: ddzState.runtime.baseBid,
          multiplier: ddzState.runtime.multiplier,
          multiplierBreakdown: ddzState.runtime.multiplierBreakdown,
          bottomCards: ddzState.runtime.landlordId ? ddzState.runtime.bottomCards.map((card) => card.code) : ['hidden', 'hidden', 'hidden'],
          tableCards: ddzState.runtime.tableDisplay.cards.map((card) => card.code),
          players: ddzState.runtime.players.map((player) => ({
            id: player.id,
            name: player.name,
            role: player.role,
            handCount: player.hand.length,
            score: player.score,
            bid: player.bid,
            lastAction: player.lastAction,
            hand: player.isHuman ? player.hand.map((card) => card.code) : undefined,
          })),
          selectedCards: ddzState.runtime.selectedCardIds,
          recentHistory: ddzState.history.slice(0, 5).map((entry) => ({
            round: entry.round,
            dealSeed: entry.dealSeed,
            winnerId: entry.winnerId,
            winningTeam: entry.winningTeam,
            multiplier: entry.multiplier,
            heroDelta: entry.heroDelta,
            eventKinds: entry.multiplierBreakdown.events.map((event) => event.kind),
          })),
          selectedHistoryEntry: selectedHistoryEntry
            ? {
                round: selectedHistoryEntry.round,
                dealSeed: selectedHistoryEntry.dealSeed,
                winnerId: selectedHistoryEntry.winnerId,
                winnerName: selectedHistoryEntry.winnerName,
                landlordName: selectedHistoryEntry.landlordName,
                heroDelta: selectedHistoryEntry.heroDelta,
                multiplier: selectedHistoryEntry.multiplier,
                eventKinds: selectedHistoryEntry.multiplierBreakdown.events.map((event) => event.kind),
              }
            : null,
        };
      } else if (state.runtime) {
        const ranked = [...state.runtime.table.players]
          .sort((a, b) => {
            if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
            return b.stack - a.stack;
          })
          .map((player, idx) => ({
            id: player.id,
            rank: idx + 1,
            stack: player.stack,
            eliminated: player.eliminated,
          }));

        payload.table = {
          handId: state.runtime.table.handId,
          stage: state.runtime.table.stage,
          pot: state.runtime.table.totalPot,
          config: {
            smallBlind: state.runtime.table.config.smallBlind,
            bigBlind: state.runtime.table.config.bigBlind,
            ante: state.runtime.table.config.sessionMode === 'tournament' ? getTournamentLevel(state.runtime.table.config).ante : 0,
            blindLevel: state.runtime.table.config.blindLevel,
            sessionMode: state.runtime.table.config.sessionMode,
            fastMode: state.runtime.table.config.fastMode,
            aiDifficulty: state.runtime.table.config.aiDifficulty,
            straddleMode: state.runtime.table.config.straddleMode ?? 'off',
            tournamentStructureId: state.runtime.table.config.tournamentStructureId ?? 'standard',
          },
          tournament:
            state.runtime.table.config.sessionMode === 'tournament'
              ? {
                  prizeLines: getTournamentPrizeLines(state.runtime.table.players.length),
                  upcomingLevels: getUpcomingTournamentLevels(state.runtime.table.config, 5),
                }
              : null,
          board: state.runtime.table.board.map((c) => c.code),
          activePlayerId: state.runtime.table.activePlayerId,
          autoAction: state.autoAction,
          standings: ranked,
          players: state.runtime.table.players.map((p) => ({
            id: p.id,
            chips: p.stack,
            bet: p.currentBet,
            folded: p.folded,
            allIn: p.allIn,
          })),
        };
      }

      if (savedSessionMeta) {
        payload.resume = savedSessionMeta;
      }

      payload.career = {
        totalSessions: state.careerProfile.totalSessions,
        totalProfit: state.careerProfile.totalProfit,
        tournamentTitles: state.careerProfile.tournamentTitles,
        itmFinishes: state.careerProfile.itmFinishes,
        bestFinish: state.careerProfile.bestFinish,
        tournamentPointsEarned: state.careerProfile.tournamentPointsEarned,
      };

      payload.replayArchive = replayArchiveSummary;
      payload.audio = {
        level: audioLevel,
      };
      payload.motion = {
        level: motionLevel,
      };
      payload.theme = {
        key: tableThemeKey,
        ownedThemeKeys: themePreferences.ownedThemeKeys,
      };
      payload.portrait = {
        humanPortraitKey,
        ownedPortraitKeys: portraitPreferences.ownedPortraitKeys,
        availableTournamentPoints: shopAvailablePoints,
      };
      payload.cardSkin = {
        key: cardSkinKey,
        ownedCardSkinKeys: cardSkinPreferences.ownedCardSkinKeys,
        availableTournamentPoints: shopAvailablePoints,
      };
      payload.effectSkin = {
        key: effectSkinKey,
        ownedEffectSkinKeys: effectSkinPreferences.ownedEffectSkinKeys,
        availableTournamentPoints: shopAvailablePoints,
      };
      payload.aiPack = {
        key: aiPackKey,
        ownedAiPackKeys: aiPackPreferences.ownedAiPackKeys,
        title: getAiPackOption(aiPackKey, language).title,
      };
      payload.legal = {
        overlayOpen: legalOverlayOpen,
        tab: legalTab,
      };
      payload.shop = {
        open: shopOpen,
        availablePoints: shopAvailablePoints,
        totalEarnedPoints: careerProfile.tournamentPointsEarned,
        portraitsOwned: portraitPreferences.ownedPortraitKeys.length,
        cardSkinsOwned: cardSkinPreferences.ownedCardSkinKeys.length,
        effectSkinsOwned: effectSkinPreferences.ownedEffectSkinKeys.length,
        themesOwned: themePreferences.ownedThemeKeys.length,
        aiPacksOwned: aiPackPreferences.ownedAiPackKeys.length,
      };

      if (state.screen === 'history' && historyPerf) {
        payload.historyPerf = historyPerf;
      }

      if (state.replayViewer) {
        payload.replay = {
          handKey: state.replayViewer.handKey,
          handId: state.replayViewer.handId,
          step: state.replayViewer.step,
          autoplay: state.replayViewer.autoplay,
        };
      }

      return JSON.stringify(payload);
    };

    window.advanceTime = (ms: number) => {
      if (gdState.screen === 'table' && gdState.runtime) {
        advanceGuandanTime(ms);
        return;
      }

      if (ddzState.screen === 'table' && ddzState.runtime) {
        advanceDouDizhuTime(ms);
        return;
      }

      if (state.screen !== 'replay' || !state.replayViewer || !currentReplayRecord) {
        return;
      }
      const jump = Math.max(1, Math.round(ms / 900));
      replaySetStep(state.replayViewer.step + jump);
    };

    return () => {
      window.render_game_to_text = undefined;
      window.advanceTime = undefined;
    };
  }, [
    advanceDouDizhuTime,
    advanceGuandanTime,
    audioLevel,
    currentReplayRecord,
    ddzState.history,
    ddzState.historyViewerOpen,
    ddzState.historyViewerRound,
    ddzState.runtime,
    ddzState.screen,
    ddzState.trusteeMode,
    gdState.history,
    gdState.runtime,
    gdState.screen,
    gdState.trusteeMode,
    historyPerf,
    aiPackKey,
    aiPackPreferences,
    language,
    humanPortraitKey,
    cardSkinKey,
    cardSkinPreferences,
    effectSkinKey,
    effectSkinPreferences,
    careerProfile.tournamentPointsEarned,
    portraitPreferences,
    shopAvailablePoints,
    shopOpen,
    legalOverlayOpen,
    legalTab,
    menuGame,
    motionLevel,
    platformState,
    replayArchiveSummary,
    replaySetStep,
    savedSessionMeta,
    state,
    themePreferences,
    tableThemeKey,
  ]);

  if (gdState.screen === 'table' && gdState.runtime) {
    return withIpadLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.guandanTable')} language={language} />}>
        <GuandanTable
          language={language}
          runtime={gdState.runtime}
          history={gdState.history}
          stats={gdState.stats}
          paused={gdState.paused}
          cardSkinKey={cardSkinKey}
          effectSkinKey={effectSkinKey}
          trusteeMode={gdState.trusteeMode}
          onBack={() => {
            backToGuandanMenu();
            setMenuGame('guandan');
          }}
          onRestart={restartGuandanSession}
          onNextRound={nextGuandanRound}
          onPause={toggleGuandanPause}
          onSetTrusteeMode={setGuandanTrusteeMode}
          onToggleCard={humanToggleGuandanCard}
          onClearSelection={humanClearGuandanSelection}
          onHint={humanGuandanHint}
          onPlay={humanGuandanPlay}
          onPass={humanGuandanPass}
          canPass={gdView.canPass}
          legalPatternCount={gdView.legalPatterns.length}
          onChangeAIDifficulty={setGuandanAIDifficulty}
        />
      </Suspense>,
    );
  }

  if (ddzState.screen === 'table' && ddzState.runtime) {
    return withIpadLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.doudizhuTable')} language={language} />}>
        <DouDizhuTable
          language={language}
          runtime={ddzState.runtime}
          history={ddzState.history}
          stats={ddzState.stats}
          paused={ddzState.paused}
          cardSkinKey={cardSkinKey}
          effectSkinKey={effectSkinKey}
          trusteeMode={ddzState.trusteeMode}
          onBack={() => {
            backToDouDizhuMenu();
            setMenuGame('doudizhu');
          }}
          onRestart={restartDouDizhuSession}
          onNextRound={nextDouDizhuRound}
          onPause={toggleDouDizhuPause}
          onSetTrusteeMode={setDouDizhuTrusteeMode}
          onBid={humanBid}
          onToggleCard={humanToggleCard}
          onSelectPattern={humanSelectPattern}
          onClearSelection={humanClearSelection}
          onHint={humanHint}
          onPlay={humanPlay}
          onPass={humanPass}
          canPass={ddzView.canPass}
          legalPatternCount={ddzView.legalPatterns.length}
          legalPatterns={ddzView.legalPatterns}
          onChangeAIDifficulty={setDouDizhuAIDifficulty}
          historyViewerOpen={ddzState.historyViewerOpen}
          historyViewerRound={ddzState.historyViewerRound}
          onOpenHistoryViewer={openDouDizhuHistoryViewer}
          onCloseHistoryViewer={closeDouDizhuHistoryViewer}
          onSelectHistoryViewerRound={selectDouDizhuHistoryViewerRound}
        />
      </Suspense>,
    );
  }

  if (state.screen === 'menu' && menuGame === 'doudizhu') {
    return withMenuLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.doudizhuMenu')} language={language} />}>
        <DouDizhuMenu
          language={language}
          onStart={(config) => {
            setMenuGame('doudizhu');
            startDouDizhuGame(config);
          }}
          onBackToHub={() => setMenuGame('hub')}
          humanPortraitKey={humanPortraitKey}
        />
      </Suspense>,
    );
  }

  if (state.screen === 'menu' && menuGame === 'guandan') {
    return withMenuLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.guandanMenu')} language={language} />}>
        <GuandanMenu
          language={language}
          humanPortraitKey={humanPortraitKey}
          onBackToHub={() => setMenuGame('hub')}
          onStart={(config) => {
            setMenuGame('guandan');
            startGuandanGame(config);
          }}
        />
      </Suspense>,
    );
  }

  if (state.screen === 'menu' && menuGame === 'holdem') {
    return withMenuLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.holdemMenu')} language={language} />}>
        <MainMenu
          language={language}
          onStart={startHoldemGame}
          onBackToHub={() => setMenuGame('hub')}
          onResume={resumeSavedSession}
          onClearResume={clearSavedSessionEntry}
          resumeMeta={savedSessionMeta}
          careerProfile={careerProfile}
          onClearCareer={clearCareerArchive}
          onImportCareer={importCareerArchive}
          humanPortraitKey={humanPortraitKey}
          portraitAvailablePoints={shopAvailablePoints}
          cardSkinKey={cardSkinKey}
          tableThemeKey={tableThemeKey}
        />
      </Suspense>,
    );
  }

  if (state.screen === 'menu') {
    return withMenuLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.hub')} language={language} />}>
        <GameHubMenu
          language={language}
          onOpenHoldem={() => setMenuGame('holdem')}
          onOpenDouDizhu={() => setMenuGame('doudizhu')}
          onOpenGuandan={() => setMenuGame('guandan')}
          onOpenShop={openShopOverlay}
          onResumeHoldem={savedSessionMeta ? resumeSavedSession : null}
          hasResumeHoldem={Boolean(savedSessionMeta)}
          availablePoints={shopAvailablePoints}
          totalEarnedPoints={careerProfile.tournamentPointsEarned}
          menuTools={
            platformState.isIpadLike ? <LanguageSwitcher language={language} onChange={setLanguage} compact label={t(language, 'common.language')} /> : null
          }
        />
      </Suspense>,
    );
  }

  if (state.screen === 'history') {
    return withIpadLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.history')} language={language} />}>
        
        <ReplayCenter
          history={replayHistory}
          stats={state.stats}
          careerProfile={careerProfile}
          currentSessionId={state.sessionId}
          replayArchive={replayArchive}
          replayArchiveSummary={replayArchiveSummary}
          onBack={openTable}
          onOpenReplay={openReplay}
          onClearReplayArchive={clearReplayArchive}
          onClearCareer={clearCareerArchive}
          onImportCareer={importCareerArchive}
          onImportReplayArchive={importReplayArchive}
          onPerfUpdate={setHistoryPerf}
        />
      </Suspense>,
    );
  }

  if (state.screen === 'replay' && currentReplayRecord && state.replayViewer) {
    return withIpadLayer(
      <Suspense fallback={<ScreenLoader label={t(language, 'loader.replay')} language={language} />}>
        <ReplayViewer
          record={currentReplayRecord}
          viewer={state.replayViewer}
          humanPortraitKey={humanPortraitKey}
          cardSkinKey={cardSkinKey}
          motionLevel={motionLevel}
          onBack={() => openHistory()}
          onPrev={() => replayStep(-1)}
          onNext={() => replayStep(1)}
          onToggleAutoplay={replayToggleAutoplay}
          onSetStep={replaySetStep}
          onJumpStage={replayJumpToStage}
        />
      </Suspense>,
    );
  }

  if (!state.runtime || !state.config) {
    return withMenuLayer(
      <Suspense fallback={<ScreenLoader label={menuGame === 'hub' ? t(language, 'loader.hub') : t(language, 'loader.holdemMenu')} language={language} />}>
        {menuGame === 'doudizhu' ? (
          <DouDizhuMenu
            language={language}
            onStart={(config) => {
              setMenuGame('doudizhu');
              startDouDizhuGame(config);
            }}
            onBackToHub={() => setMenuGame('hub')}
            humanPortraitKey={humanPortraitKey}
          />
        ) : menuGame === 'guandan' ? (
          <GuandanMenu
            language={language}
            humanPortraitKey={humanPortraitKey}
            onBackToHub={() => setMenuGame('hub')}
            onStart={(config) => {
              setMenuGame('guandan');
              startGuandanGame(config);
            }}
          />
        ) : menuGame === 'holdem' ? (
          <MainMenu
            language={language}
            onStart={startHoldemGame}
            onBackToHub={() => setMenuGame('hub')}
            onResume={resumeSavedSession}
            onClearResume={clearSavedSessionEntry}
            resumeMeta={savedSessionMeta}
            careerProfile={careerProfile}
            onClearCareer={clearCareerArchive}
            onImportCareer={importCareerArchive}
            humanPortraitKey={humanPortraitKey}
            portraitAvailablePoints={shopAvailablePoints}
            cardSkinKey={cardSkinKey}
            tableThemeKey={tableThemeKey}
          />
        ) : (
          <GameHubMenu
            language={language}
            onOpenHoldem={() => setMenuGame('holdem')}
            onOpenDouDizhu={() => setMenuGame('doudizhu')}
            onOpenGuandan={() => setMenuGame('guandan')}
            onOpenShop={openShopOverlay}
            onResumeHoldem={savedSessionMeta ? resumeSavedSession : null}
            hasResumeHoldem={Boolean(savedSessionMeta)}
            availablePoints={shopAvailablePoints}
            totalEarnedPoints={careerProfile.tournamentPointsEarned}
          />
        )}
      </Suspense>,
    );
  }

  return withIpadLayer(
    <Suspense fallback={<ScreenLoader label={t(language, 'loader.table')} language={language} />}>
      <div className="app-shell" data-motion-level={motionLevel}>
        <TopHud
          language={language}
          table={state.runtime.table}
          config={state.config}
          banner={state.banner}
          paused={state.paused}
          onPause={togglePause}
          onNextHand={nextHand}
          onRestart={restartSession}
          onHistory={openHistory}
          onMenu={() => {
            setMenuGame('holdem');
            backToMenu();
          }}
          onChangeAIDifficulty={setAIDifficulty}
          audioLevel={audioLevel}
          audioLabel={audioLevelLabel(audioLevel)}
          onCycleAudioLevel={() => setAudioLevel((prev) => cycleAudioLevel(prev))}
          motionLevel={motionLevel}
          motionLabel={motionLevelLabel(motionLevel)}
          onCycleMotionLevel={() => setMotionLevel((prev) => cycleMotionLevel(prev))}
          tableThemeKey={tableThemeKey}
          tableThemeLabel={getTableThemeOption(tableThemeKey, language).shortLabel}
          onCycleTableTheme={() => setThemePreferences((prev) => ({ ...prev, tableThemeKey: cycleOwnedTableTheme(prev.tableThemeKey, prev.ownedThemeKeys) }))}
        />

        <TableScene
          table={state.runtime.table}
          humanPortraitKey={humanPortraitKey}
          cardSkinKey={cardSkinKey}
          effectSkinKey={effectSkinKey}
          motionLevel={motionLevel}
          paused={state.paused}
          humanOptions={humanActionOptions}
          autoAction={autoAction}
          onAction={humanAction}
          onSetAutoAction={setAutoAction}
          events={state.runtime.replayBuilder.events}
          history={state.history}
          onNextHand={nextHand}
          onBackToMenu={() => {
            setMenuGame('holdem');
            backToMenu();
          }}
        />
      </div>
    </Suspense>,
  );
}

export default App;
