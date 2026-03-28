import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { t, type AppLanguage } from '../../i18n';
import { getAiPackOptions } from '../../content/aiPacks';
import type { AIPackKey } from '../../types/aiPack';
import type { CardSkinKey } from '../../types/cardSkin';
import type { EffectSkinKey } from '../../types/effectSkin';
import type { HumanPortraitKey } from '../../types/portrait';
import type { TableThemeKey } from '../../types/theme';
import { getCardSkinOptions } from '../cardSkins';
import { getEffectSkinOptions } from '../effectSkins';
import { getHumanPortraitOptions } from '../playerPortraits';
import { getTableThemeOptions } from '../tableThemes';
import { CardView } from './CardView';
import { CardSkinDesignPreview } from './CardSkinDesignPreview';
import { DouDizhuCard } from './DouDizhuCard';
import { PlayerPortrait } from './PlayerPortrait';

type ShopTab = 'portrait' | 'card-skin' | 'effect-skin' | 'theme' | 'ai-pack';
type ShopFilter = 'all' | 'owned' | 'locked';

interface MenuShopOverlayProps {
  language: AppLanguage;
  open: boolean;
  onClose: () => void;
  availablePoints: number;
  totalEarnedPoints: number;
  portraitPointsSpent: number;
  cardSkinPointsSpent: number;
  effectSkinPointsSpent: number;
  themePointsSpent: number;
  aiPackPointsSpent: number;
  humanPortraitKey: HumanPortraitKey;
  portraitOwnedKeys: HumanPortraitKey[];
  onChangeHumanPortraitKey: (key: HumanPortraitKey) => void;
  onPurchaseHumanPortrait: (key: HumanPortraitKey) => { ok: boolean; message: string; purchased: boolean; messageKey?: string; messageVars?: Record<string, string | number> };
  cardSkinKey: CardSkinKey;
  cardSkinOwnedKeys: CardSkinKey[];
  onChangeCardSkinKey: (key: CardSkinKey) => void;
  onPurchaseCardSkin: (key: CardSkinKey) => { ok: boolean; message: string; purchased: boolean; messageKey?: string; messageVars?: Record<string, string | number> };
  effectSkinKey: EffectSkinKey;
  effectSkinOwnedKeys: EffectSkinKey[];
  onChangeEffectSkinKey: (key: EffectSkinKey) => void;
  onPurchaseEffectSkin: (key: EffectSkinKey) => { ok: boolean; message: string; purchased: boolean; messageKey?: string; messageVars?: Record<string, string | number> };
  tableThemeKey: TableThemeKey;
  themeOwnedKeys: TableThemeKey[];
  onChangeTableThemeKey: (key: TableThemeKey) => void;
  onPurchaseTableTheme: (key: TableThemeKey) => { ok: boolean; message: string; purchased: boolean; messageKey?: string; messageVars?: Record<string, string | number> };
  aiPackKey: AIPackKey;
  aiPackOwnedKeys: AIPackKey[];
  onChangeAiPackKey: (key: AIPackKey) => void;
  onPurchaseAiPack: (key: AIPackKey) => { ok: boolean; message: string; purchased: boolean; messageKey?: string; messageVars?: Record<string, string | number> };
}

function shopFeedbackMessage(
  language: AppLanguage,
  result: { message: string; messageKey?: string; messageVars?: Record<string, string | number> },
): string {
  return result.messageKey ? t(language, result.messageKey, result.messageVars) : result.message;
}

function matchesFilter(filter: ShopFilter, owned: boolean): boolean {
  if (filter === 'owned') return owned;
  if (filter === 'locked') return !owned;
  return true;
}

function handlePreviewCardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, activatePreview: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  event.preventDefault();
  activatePreview();
}

function readHorizontalScrollState(element: HTMLElement | null) {
  if (!element) {
    return { left: false, right: false };
  }
  return {
    left: element.scrollLeft > 4,
    right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
  };
}

function scrollActiveChipIntoView(container: HTMLElement | null, selector: string, behavior: ScrollBehavior) {
  const activeChip = container?.querySelector<HTMLElement>(selector);
  activeChip?.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior,
  });
}

const EMPTY_SCROLL_STATE = { left: false, right: false } as const;

export function MenuShopOverlay({
  language,
  open,
  onClose,
  availablePoints,
  totalEarnedPoints,
  portraitPointsSpent,
  cardSkinPointsSpent,
  effectSkinPointsSpent,
  themePointsSpent,
  aiPackPointsSpent,
  humanPortraitKey,
  portraitOwnedKeys,
  onChangeHumanPortraitKey,
  onPurchaseHumanPortrait,
  cardSkinKey,
  cardSkinOwnedKeys,
  onChangeCardSkinKey,
  onPurchaseCardSkin,
  effectSkinKey,
  effectSkinOwnedKeys,
  onChangeEffectSkinKey,
  onPurchaseEffectSkin,
  tableThemeKey,
  themeOwnedKeys,
  onChangeTableThemeKey,
  onPurchaseTableTheme,
  aiPackKey,
  aiPackOwnedKeys,
  onChangeAiPackKey,
  onPurchaseAiPack,
}: MenuShopOverlayProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [tab, setTab] = useState<ShopTab>('portrait');
  const [filter, setFilter] = useState<ShopFilter>('all');
  const [feedback, setFeedback] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null);
  const [previewPortraitKey, setPreviewPortraitKey] = useState<HumanPortraitKey | null>(null);
  const [previewCardSkinKey, setPreviewCardSkinKey] = useState<CardSkinKey | null>(null);
  const [previewEffectSkinKey, setPreviewEffectSkinKey] = useState<EffectSkinKey | null>(null);
  const [previewThemeKey, setPreviewThemeKey] = useState<TableThemeKey | null>(null);
  const [previewAiPackKey, setPreviewAiPackKey] = useState<AIPackKey | null>(null);
  const [tabScrollState, setTabScrollState] = useState({ left: false, right: false });
  const [filterScrollState, setFilterScrollState] = useState({ left: false, right: false });
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const filterStripRef = useRef<HTMLDivElement | null>(null);
  const filterLabels: Record<ShopFilter, string> = {
    all: t(language, 'common.all'),
    owned: t(language, 'common.ownedFilter'),
    locked: t(language, 'common.locked'),
  };

  const portraitOptions = useMemo(() => getHumanPortraitOptions(language), [language]);
  const cardSkinOptions = useMemo(() => getCardSkinOptions(language), [language]);
  const effectSkinOptions = useMemo(() => getEffectSkinOptions(language), [language]);
  const tableThemeOptions = useMemo(() => getTableThemeOptions(language), [language]);
  const aiPackOptions = useMemo(() => getAiPackOptions(language), [language]);

  const ownedPortraitSet = useMemo(() => new Set<HumanPortraitKey>(portraitOwnedKeys), [portraitOwnedKeys]);
  const ownedCardSkinSet = useMemo(() => new Set<CardSkinKey>(cardSkinOwnedKeys), [cardSkinOwnedKeys]);
  const ownedEffectSkinSet = useMemo(() => new Set<EffectSkinKey>(effectSkinOwnedKeys), [effectSkinOwnedKeys]);
  const ownedThemeSet = useMemo(() => new Set<TableThemeKey>(themeOwnedKeys), [themeOwnedKeys]);
  const ownedAiPackSet = useMemo(() => new Set<AIPackKey>(aiPackOwnedKeys), [aiPackOwnedKeys]);
  const visibleTabScrollState = open && isIpadLike ? tabScrollState : EMPTY_SCROLL_STATE;
  const visibleFilterScrollState = open && isIpadLike ? filterScrollState : EMPTY_SCROLL_STATE;

  const spentTotal = portraitPointsSpent + cardSkinPointsSpent + effectSkinPointsSpent + themePointsSpent + aiPackPointsSpent;

  const handleClose = useCallback(() => {
    setFilter('all');
    setFeedback(null);
    setPreviewPortraitKey(null);
    setPreviewCardSkinKey(null);
    setPreviewEffectSkinKey(null);
    setPreviewThemeKey(null);
    setPreviewAiPackKey(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    if (!open || !isIpadLike) {
      return;
    }

    const strip = tabStripRef.current;
    if (!strip) {
      return;
    }

    let frame = 0;
    const syncState = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setTabScrollState(readHorizontalScrollState(strip));
      });
    };

    syncState();
    strip.addEventListener('scroll', syncState, { passive: true });
    window.addEventListener('resize', syncState);
    return () => {
      cancelAnimationFrame(frame);
      strip.removeEventListener('scroll', syncState);
      window.removeEventListener('resize', syncState);
    };
  }, [isIpadLike, language, open]);

  useEffect(() => {
    if (!open || !isIpadLike) {
      return;
    }

    const strip = filterStripRef.current;
    if (!strip) {
      return;
    }

    let frame = 0;
    const syncState = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setFilterScrollState(readHorizontalScrollState(strip));
      });
    };

    syncState();
    strip.addEventListener('scroll', syncState, { passive: true });
    window.addEventListener('resize', syncState);
    return () => {
      cancelAnimationFrame(frame);
      strip.removeEventListener('scroll', syncState);
      window.removeEventListener('resize', syncState);
    };
  }, [filterLabels.all, filterLabels.locked, filterLabels.owned, isIpadLike, open]);

  useEffect(() => {
    if (!open || !isIpadLike) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollActiveChipIntoView(tabStripRef.current, `[data-shop-tab="${tab}"]`, 'smooth');
      setTabScrollState(readHorizontalScrollState(tabStripRef.current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isIpadLike, open, tab]);

  useEffect(() => {
    if (!open || !isIpadLike) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollActiveChipIntoView(filterStripRef.current, `[data-shop-filter="${filter}"]`, 'smooth');
      setFilterScrollState(readHorizontalScrollState(filterStripRef.current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filter, isIpadLike, open]);

  const activePreviewPortraitKey = previewPortraitKey ?? humanPortraitKey;
  const activePreviewCardSkinKey = previewCardSkinKey ?? cardSkinKey;
  const activePreviewEffectSkinKey = previewEffectSkinKey ?? effectSkinKey;
  const activePreviewThemeKey = previewThemeKey ?? tableThemeKey;
  const activePreviewAiPackKey = previewAiPackKey ?? aiPackKey;

  const activePreviewPortrait = useMemo(
    () => portraitOptions.find((option) => (option.key as HumanPortraitKey) === activePreviewPortraitKey) ?? portraitOptions[0],
    [activePreviewPortraitKey, portraitOptions],
  );
  const activePreviewCardSkin = useMemo(
    () => cardSkinOptions.find((option) => option.key === activePreviewCardSkinKey) ?? cardSkinOptions[0],
    [activePreviewCardSkinKey, cardSkinOptions],
  );
  const activePreviewEffectSkin = useMemo(
    () => effectSkinOptions.find((option) => option.key === activePreviewEffectSkinKey) ?? effectSkinOptions[0],
    [activePreviewEffectSkinKey, effectSkinOptions],
  );
  const activePreviewTheme = useMemo(
    () => tableThemeOptions.find((option) => option.key === activePreviewThemeKey) ?? tableThemeOptions[0],
    [activePreviewThemeKey, tableThemeOptions],
  );
  const activePreviewAiPack = useMemo(
    () => aiPackOptions.find((option) => option.key === activePreviewAiPackKey) ?? aiPackOptions[0],
    [activePreviewAiPackKey, aiPackOptions],
  );

  const filteredPortraitOptions = useMemo(
    () => portraitOptions.filter((option) => matchesFilter(filter, ownedPortraitSet.has(option.key as HumanPortraitKey))),
    [filter, ownedPortraitSet, portraitOptions],
  );
  const filteredCardSkinOptions = useMemo(
    () => cardSkinOptions.filter((option) => matchesFilter(filter, ownedCardSkinSet.has(option.key))),
    [cardSkinOptions, filter, ownedCardSkinSet],
  );
  const filteredEffectSkinOptions = useMemo(
    () => effectSkinOptions.filter((option) => matchesFilter(filter, ownedEffectSkinSet.has(option.key))),
    [effectSkinOptions, filter, ownedEffectSkinSet],
  );
  const filteredThemeOptions = useMemo(
    () => tableThemeOptions.filter((option) => matchesFilter(filter, ownedThemeSet.has(option.key))),
    [filter, ownedThemeSet, tableThemeOptions],
  );
  const filteredAiPackOptions = useMemo(
    () => aiPackOptions.filter((option) => matchesFilter(filter, ownedAiPackSet.has(option.key))),
    [aiPackOptions, filter, ownedAiPackSet],
  );

  const currentItemCount =
    tab === 'portrait'
      ? filteredPortraitOptions.length
      : tab === 'card-skin'
        ? filteredCardSkinOptions.length
        : tab === 'effect-skin'
          ? filteredEffectSkinOptions.length
        : tab === 'theme'
          ? filteredThemeOptions.length
          : filteredAiPackOptions.length;

  const currentOwnedCount =
    tab === 'portrait'
      ? portraitOwnedKeys.length
      : tab === 'card-skin'
        ? cardSkinOwnedKeys.length
        : tab === 'effect-skin'
          ? effectSkinOwnedKeys.length
        : tab === 'theme'
          ? themeOwnedKeys.length
          : aiPackOwnedKeys.length;

  const currentTotalCount =
    tab === 'portrait'
      ? portraitOptions.length
      : tab === 'card-skin'
        ? cardSkinOptions.length
        : tab === 'effect-skin'
          ? effectSkinOptions.length
        : tab === 'theme'
          ? tableThemeOptions.length
          : aiPackOptions.length;

  const focusDescription =
    tab === 'portrait'
      ? activePreviewPortrait.description
      : tab === 'card-skin'
        ? activePreviewCardSkin.description
        : tab === 'effect-skin'
          ? activePreviewEffectSkin.description
        : tab === 'theme'
          ? activePreviewTheme.description
          : activePreviewAiPack.description;
  const focusLabel =
    tab === 'portrait'
      ? activePreviewPortrait.title
      : tab === 'card-skin'
        ? activePreviewCardSkin.title
        : tab === 'effect-skin'
          ? activePreviewEffectSkin.title
        : tab === 'theme'
          ? activePreviewTheme.title
          : activePreviewAiPack.title;
  const focusEyebrow =
    tab === 'portrait'
      ? activePreviewPortrait.sigil
      : tab === 'card-skin'
        ? activePreviewCardSkin.eyebrow
        : tab === 'effect-skin'
          ? activePreviewEffectSkin.eyebrow
        : tab === 'theme'
          ? activePreviewTheme.eyebrow
          : activePreviewAiPack.eyebrow;

  if (!open) {
    return null;
  }

  return (
    <div className="menu-shop-overlay" role="presentation" onClick={handleClose}>
      <section className="menu-shop-sheet glass-panel" role="dialog" aria-modal="true" aria-label={t(language, 'shop.title')} onClick={(event) => event.stopPropagation()}>
        <div className="menu-shop-head">
          <div>
            <strong>{t(language, 'shop.title')}</strong>
          </div>
          <div className="menu-shop-meta">
            <span>{t(language, 'common.totalEarned')} {totalEarnedPoints}</span>
            <strong>{t(language, 'common.availableNow')} {availablePoints}</strong>
            <button className="btn mini" type="button" onClick={handleClose}>
              {t(language, 'common.close')}
            </button>
          </div>
        </div>

        <div className="menu-shop-layout">
          <aside className="menu-shop-preview-panel glass-panel">
            <div className="menu-shop-preview-headline">
              <div>
                <strong>{t(language, 'shop.livePreview')}</strong>
                <span>
                  {focusEyebrow} · {focusLabel}
                </span>
              </div>
              <div className="menu-shop-preview-head-actions">
                <em>
                  {t(language, 'common.currentCategory')} {filterLabels[filter]} · {currentItemCount}/{currentTotalCount}
                </em>
              </div>
            </div>

            <div
              className={`menu-shop-showcase tab-${tab} theme-preview-${activePreviewTheme.key}`}
              style={
                {
                  '--theme-felt-preview': activePreviewTheme.swatch.felt,
                  '--theme-shell-preview': activePreviewTheme.swatch.shell,
                  '--theme-accent-preview': activePreviewTheme.swatch.accent,
                  '--theme-trim-preview': activePreviewTheme.swatch.trim,
                } as CSSProperties
              }
            >
              <span className="menu-shop-showcase-shell" />
              <span className="menu-shop-showcase-felt" />
              <span className="menu-shop-showcase-ring" />
              <span className="menu-shop-showcase-glow" />

              {tab === 'ai-pack' ? (
                <div className={`menu-shop-showcase-ai-grid tone-${activePreviewAiPack.previewTone} tier-${activePreviewAiPack.tier}`}>
                  {activePreviewAiPack.names.slice(0, 4).map((name, index) => (
                    <div
                      key={`${activePreviewAiPack.key}-${name}`}
                      className={`menu-shop-showcase-ai-card tone-${activePreviewAiPack.previewTone} tier-${activePreviewAiPack.tier}`}
                    >
                      <PlayerPortrait
                        player={{
                          id: `preview-ai-${index}`,
                          name,
                          style: activePreviewAiPack.stylePlan[index % activePreviewAiPack.stylePlan.length] ?? 'balanced',
                          isHuman: false,
                          portraitKey: activePreviewAiPack.portraitKeys[index % activePreviewAiPack.portraitKeys.length],
                        }}
                        mood={index === 0 ? 'focused' : 'calm'}
                        size="seat-lg"
                        variant="panel"
                      />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              ) : tab === 'effect-skin' ? (
                <div className={`menu-shop-showcase-effects fx-style-${activePreviewEffectSkin.key} motif-${activePreviewEffectSkin.motif} tier-${activePreviewEffectSkin.tier}`}>
                  <div className={`menu-shop-effect-stage motif-${activePreviewEffectSkin.motif} tier-${activePreviewEffectSkin.tier}`}>
                    <span className="menu-shop-effect-chip chip-a" />
                    <span className="menu-shop-effect-chip chip-b" />
                    <span className="menu-shop-effect-wave wave-a" />
                    <span className="menu-shop-effect-wave wave-b" />
                    <span className="menu-shop-effect-spark spark-a" />
                    <span className="menu-shop-effect-spark spark-b" />
                    <span className="menu-shop-effect-sigil sigil-a" />
                    <span className="menu-shop-effect-sigil sigil-b" />
                    <strong>{activePreviewEffectSkin.previewLabel}</strong>
                    <em>{t(language, 'shop.previewEffectNote')}</em>
                  </div>
                </div>
              ) : tab === 'card-skin' ? (
                <CardSkinDesignPreview language={language} skinKey={activePreviewCardSkin.key} />
              ) : (
                <>
                  <div className="menu-shop-showcase-portrait">
                    <PlayerPortrait
                      player={{
                        id: 'P0',
                        name: t(language, 'common.you'),
                        style: 'balanced',
                        isHuman: true,
                        portraitKey: activePreviewPortrait.key as HumanPortraitKey,
                      }}
                      mood="focused"
                      size="focus"
                      variant="panel"
                    />
                  </div>
                  <div className="menu-shop-showcase-cards">
                    <div className="menu-shop-showcase-card-row showcase-six-row">
                      <CardView hidden size="seat-roomy" cardSkinKey={activePreviewCardSkin.key} animated={false} />
                      <CardView card={{ suit: 'clubs', rank: 9, code: `shop-9-${activePreviewCardSkin.key}` }} size="seat-roomy" cardSkinKey={activePreviewCardSkin.key} animated={false} />
                      <CardView card={{ suit: 'spades', rank: 11, code: `shop-j-${activePreviewCardSkin.key}` }} size="seat-roomy" cardSkinKey={activePreviewCardSkin.key} animated={false} />
                      <CardView card={{ suit: 'hearts', rank: 12, code: `shop-q-${activePreviewCardSkin.key}` }} size="seat-roomy" cardSkinKey={activePreviewCardSkin.key} animated={false} />
                      <CardView card={{ suit: 'diamonds', rank: 13, code: `shop-k-${activePreviewCardSkin.key}` }} size="seat-roomy" cardSkinKey={activePreviewCardSkin.key} animated={false} />
                      <DouDizhuCard card={{ suit: 'joker', rank: 17, label: 'JOKER', shortLabel: 'JOKER' }} compact cardSkinKey={activePreviewCardSkin.key} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="menu-shop-preview-copy">{focusDescription}</p>

            <div className="menu-shop-balance-grid">
              <div className="menu-shop-balance-card">
                <span>{t(language, 'common.availableNow')}</span>
                <strong>{availablePoints}</strong>
              </div>
              <div className="menu-shop-balance-card">
                <span>{t(language, 'common.totalEarned')}</span>
                <strong>{totalEarnedPoints}</strong>
              </div>
              <div className="menu-shop-balance-card">
                <span>{t(language, 'common.totalSpent')}</span>
                <strong>{spentTotal}</strong>
              </div>
            </div>

            <div className="menu-shop-spend-breakdown">
              <div>
                <span>{t(language, 'shop.spendPortrait')}</span>
                <strong>{portraitPointsSpent}</strong>
              </div>
              <div>
                <span>{t(language, 'shop.spendCardSkin')}</span>
                <strong>{cardSkinPointsSpent}</strong>
              </div>
              <div>
                <span>{t(language, 'shop.spendEffectSkin')}</span>
                <strong>{effectSkinPointsSpent}</strong>
              </div>
              <div>
                <span>{t(language, 'shop.spendTheme')}</span>
                <strong>{themePointsSpent}</strong>
              </div>
              <div>
                <span>{t(language, 'shop.spendAiPack')}</span>
                <strong>{aiPackPointsSpent}</strong>
              </div>
            </div>
          </aside>

          <div className="menu-shop-catalog">
            <div
              ref={tabStripRef}
              className={`menu-shop-tabs ${visibleTabScrollState.left ? 'can-scroll-left' : ''} ${visibleTabScrollState.right ? 'can-scroll-right' : ''}`}
            >
              <button data-shop-tab="portrait" className={`btn mini ${tab === 'portrait' ? 'primary' : ''}`} type="button" onClick={() => setTab('portrait')}>
                {t(language, 'shop.portrait')}
              </button>
              <button data-shop-tab="card-skin" className={`btn mini ${tab === 'card-skin' ? 'primary' : ''}`} type="button" onClick={() => setTab('card-skin')}>
                {t(language, 'shop.cardSkin')}
              </button>
              <button data-shop-tab="effect-skin" className={`btn mini ${tab === 'effect-skin' ? 'primary' : ''}`} type="button" onClick={() => setTab('effect-skin')}>
                {t(language, 'shop.effectSkin')}
              </button>
              <button data-shop-tab="theme" className={`btn mini ${tab === 'theme' ? 'primary' : ''}`} type="button" onClick={() => setTab('theme')}>
                {t(language, 'shop.theme')}
              </button>
              <button data-shop-tab="ai-pack" className={`btn mini ${tab === 'ai-pack' ? 'primary' : ''}`} type="button" onClick={() => setTab('ai-pack')}>
                {t(language, 'shop.aiPack')}
              </button>
            </div>

            <div className="menu-shop-toolbar">
              <div className="menu-shop-toolbar-copy">
                <strong>
                  {tab === 'portrait'
                    ? t(language, 'shop.portraitVault')
                    : tab === 'card-skin'
                      ? t(language, 'shop.cardSkinVault')
                      : tab === 'effect-skin'
                        ? t(language, 'shop.effectSkinVault')
                        : tab === 'theme'
                          ? t(language, 'shop.themeVault')
                          : t(language, 'shop.aiPackVault')}
                </strong>
                <span>
                  {t(language, 'common.owned')} {currentOwnedCount}/{currentTotalCount} · {t(language, 'common.filter')} {filterLabels[filter]}
                </span>
              </div>
              <div
                ref={filterStripRef}
                className={`menu-shop-filter-group ${visibleFilterScrollState.left ? 'can-scroll-left' : ''} ${visibleFilterScrollState.right ? 'can-scroll-right' : ''}`}
              >
                {(Object.keys(filterLabels) as ShopFilter[]).map((entry) => (
                  <button
                    key={entry}
                    data-shop-filter={entry}
                    className={`btn mini ${filter === entry ? 'primary' : ''}`}
                    type="button"
                    onClick={() => setFilter(entry)}
                  >
                    {filterLabels[entry]}
                  </button>
                ))}
              </div>
            </div>

            {feedback && <div className={`career-feedback ${feedback.tone}`}>{feedback.message}</div>}

            <div className="menu-shop-panel">
              {tab === 'portrait' ? (
                <div className="menu-shop-grid portrait">
                  {filteredPortraitOptions.map((option) => {
                    const portraitKey = option.key as HumanPortraitKey;
                    const owned = ownedPortraitSet.has(portraitKey);
                    const active = portraitKey === humanPortraitKey;
                    const previewing = portraitKey === activePreviewPortraitKey;
                    return (
                      <div
                        key={portraitKey}
                        className={`menu-shop-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
                        style={option.styleVars}
                        tabIndex={0}
                        onMouseEnter={() => setPreviewPortraitKey(portraitKey)}
                        onFocus={() => setPreviewPortraitKey(portraitKey)}
                        onClick={() => setPreviewPortraitKey(portraitKey)}
                        onKeyDown={(event) => handlePreviewCardKeyDown(event, () => setPreviewPortraitKey(portraitKey))}
                      >
                        <div className="menu-portrait-preview">
                          <PlayerPortrait
                            player={{ id: 'P0', name: t(language, 'common.you'), style: 'balanced', isHuman: true, portraitKey }}
                            mood={active ? 'focused' : 'calm'}
                            size="focus"
                            variant="panel"
                          />
                        </div>
                        <div className="menu-shop-copy">
                          <strong>{option.title}</strong>
                          <span>{option.starter ? t(language, 'common.free') : `${option.sigil} · ${option.unlockCost}`}</span>
                          <p>{option.description}</p>
                        </div>
                        <div className="menu-shop-foot">
                          <span className={`menu-portrait-price ${option.starter ? 'starter' : owned ? 'owned' : 'locked'}`}>
                            {active ? t(language, 'common.currentlyUsing') : owned ? t(language, 'common.owned') : option.starter ? t(language, 'common.free') : `${option.unlockCost}`}
                          </span>
                          {active ? (
                            <button className="btn mini" type="button" disabled>
                              {t(language, 'common.currentSkin')}
                            </button>
                          ) : owned ? (
                            <button
                              className="btn mini primary"
                              type="button"
                              onClick={() => {
                                onChangeHumanPortraitKey(portraitKey);
                                setFeedback({ tone: 'neutral', message: `${t(language, 'common.equip')} ${option.title}` });
                              }}
                            >
                              {t(language, 'common.equip')}
                            </button>
                          ) : (
                            <button
                              className="btn mini primary"
                              type="button"
                              disabled={availablePoints < option.unlockCost}
                              onClick={() => {
                                const result = onPurchaseHumanPortrait(portraitKey);
                                setFeedback({ tone: result.ok ? 'neutral' : 'error', message: shopFeedbackMessage(language, result) });
                              }}
                            >
                              {t(language, 'common.buy')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {tab === 'card-skin' ? (
                <div className="menu-shop-grid card-skin">
                  {filteredCardSkinOptions.map((option) => {
                    const owned = ownedCardSkinSet.has(option.key);
                    const active = option.key === cardSkinKey;
                    const previewing = option.key === activePreviewCardSkinKey;
                    return (
                      <div
                        key={option.key}
                        className={`menu-shop-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
                        tabIndex={0}
                        onMouseEnter={() => setPreviewCardSkinKey(option.key)}
                        onFocus={() => setPreviewCardSkinKey(option.key)}
                        onClick={() => setPreviewCardSkinKey(option.key)}
                        onKeyDown={(event) => handlePreviewCardKeyDown(event, () => setPreviewCardSkinKey(option.key))}
                      >
                        <div className="menu-card-skin-preview">
                          <CardSkinDesignPreview language={language} skinKey={option.key} compact />
                        </div>
                        <div className="menu-shop-copy">
                          <strong>{option.title}</strong>
                          <span>{option.starter ? t(language, 'common.free') : `${option.eyebrow} · ${option.unlockCost}`}</span>
                          <p>{option.description}</p>
                        </div>
                        <div className="menu-shop-foot">
                          <span className={`menu-portrait-price ${option.starter ? 'starter' : owned ? 'owned' : 'locked'}`}>
                            {active ? t(language, 'common.currentlyUsing') : owned ? t(language, 'common.owned') : option.starter ? t(language, 'common.free') : `${option.unlockCost}`}
                          </span>
                          {active ? (
                            <button className="btn mini" type="button" disabled>
                              {t(language, 'common.currentCardFace')}
                            </button>
                          ) : owned ? (
                            <button
                              className="btn mini primary"
                              type="button"
                              onClick={() => {
                                onChangeCardSkinKey(option.key);
                                setFeedback({ tone: 'neutral', message: `${t(language, 'common.use')} ${option.title}` });
                              }}
                            >
                              {t(language, 'common.use')}
                            </button>
                          ) : (
                            <button
                              className="btn mini primary"
                              type="button"
                              disabled={availablePoints < option.unlockCost}
                              onClick={() => {
                                const result = onPurchaseCardSkin(option.key);
                                setFeedback({ tone: result.ok ? 'neutral' : 'error', message: shopFeedbackMessage(language, result) });
                              }}
                            >
                              {t(language, 'common.buy')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {tab === 'effect-skin' ? (
                <div className="menu-shop-grid effect-skin">
                  {filteredEffectSkinOptions.map((option) => {
                    const owned = ownedEffectSkinSet.has(option.key);
                    const active = option.key === effectSkinKey;
                    const previewing = option.key === activePreviewEffectSkinKey;
                    return (
                      <div
                        key={option.key}
                        className={`menu-shop-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
                        tabIndex={0}
                        onMouseEnter={() => setPreviewEffectSkinKey(option.key)}
                        onFocus={() => setPreviewEffectSkinKey(option.key)}
                        onClick={() => setPreviewEffectSkinKey(option.key)}
                        onKeyDown={(event) => handlePreviewCardKeyDown(event, () => setPreviewEffectSkinKey(option.key))}
                      >
                        <div className={`menu-effect-skin-preview fx-style-${option.key} motif-${option.motif} tier-${option.tier}`}>
                          <span className="menu-effect-skin-ring ring-a" />
                          <span className="menu-effect-skin-ring ring-b" />
                          <span className="menu-effect-skin-spark spark-a" />
                          <span className="menu-effect-skin-spark spark-b" />
                          <span className="menu-shop-effect-sigil sigil-a" />
                          <span className="menu-shop-effect-sigil sigil-b" />
                          <strong>{option.previewLabel}</strong>
                        </div>
                        <div className="menu-shop-copy">
                          <strong>{option.title}</strong>
                          <span>{option.starter ? t(language, 'common.free') : `${option.eyebrow} · ${option.unlockCost}`}</span>
                          <p>{option.description}</p>
                        </div>
                        <div className="menu-shop-foot">
                          <span className={`menu-portrait-price ${option.starter ? 'starter' : owned ? 'owned' : 'locked'}`}>
                            {active ? t(language, 'common.currentlyUsing') : owned ? t(language, 'common.owned') : option.starter ? t(language, 'common.free') : `${option.unlockCost}`}
                          </span>
                          {active ? (
                            <button className="btn mini" type="button" disabled>
                              {t(language, 'common.currentEffect')}
                            </button>
                          ) : owned ? (
                            <button
                              className="btn mini primary"
                              type="button"
                              onClick={() => {
                                onChangeEffectSkinKey(option.key);
                                setFeedback({ tone: 'neutral', message: `${t(language, 'common.use')} ${option.title}` });
                              }}
                            >
                              {t(language, 'common.use')}
                            </button>
                          ) : (
                            <button
                              className="btn mini primary"
                              type="button"
                              disabled={availablePoints < option.unlockCost}
                              onClick={() => {
                                const result = onPurchaseEffectSkin(option.key);
                                setFeedback({ tone: result.ok ? 'neutral' : 'error', message: shopFeedbackMessage(language, result) });
                              }}
                            >
                              {t(language, 'common.buy')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {tab === 'theme' ? (
                <div className="menu-shop-grid theme">
                  {filteredThemeOptions.map((option) => {
                    const owned = ownedThemeSet.has(option.key);
                    const active = option.key === tableThemeKey;
                    const previewing = option.key === activePreviewThemeKey;
                    return (
                      <div
                        key={option.key}
                        className={`menu-shop-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
                        tabIndex={0}
                        onMouseEnter={() => setPreviewThemeKey(option.key)}
                        onFocus={() => setPreviewThemeKey(option.key)}
                        onClick={() => setPreviewThemeKey(option.key)}
                        onKeyDown={(event) => handlePreviewCardKeyDown(event, () => setPreviewThemeKey(option.key))}
                      >
                        <div
                          className="menu-theme-swatch"
                          style={
                            {
                              '--theme-felt-preview': option.swatch.felt,
                              '--theme-shell-preview': option.swatch.shell,
                              '--theme-accent-preview': option.swatch.accent,
                              '--theme-trim-preview': option.swatch.trim,
                            } as CSSProperties
                          }
                        >
                          <span className="theme-shell" />
                          <span className="theme-felt" />
                          <span className="theme-ring" />
                          <span className="theme-glow" />
                        </div>
                        <div className="menu-shop-copy">
                          <strong>{option.title}</strong>
                          <span>{option.starter ? t(language, 'common.free') : `${option.eyebrow} · ${option.unlockCost}`}</span>
                          <p>{option.description}</p>
                        </div>
                        <div className="menu-shop-foot">
                          <span className={`menu-portrait-price ${option.starter ? 'starter' : owned ? 'owned' : 'locked'}`}>
                            {active ? t(language, 'common.currentlyUsing') : owned ? t(language, 'common.owned') : option.starter ? t(language, 'common.free') : `${option.unlockCost}`}
                          </span>
                          {active ? (
                            <button className="btn mini" type="button" disabled>
                              {t(language, 'common.currentTheme')}
                            </button>
                          ) : owned ? (
                            <button
                              className="btn mini primary"
                              type="button"
                              onClick={() => {
                                onChangeTableThemeKey(option.key);
                                setFeedback({ tone: 'neutral', message: `${t(language, 'common.use')} ${option.title}` });
                              }}
                            >
                              {t(language, 'common.use')}
                            </button>
                          ) : (
                            <button
                              className="btn mini primary"
                              type="button"
                              disabled={availablePoints < option.unlockCost}
                              onClick={() => {
                                const result = onPurchaseTableTheme(option.key);
                                setFeedback({ tone: result.ok ? 'neutral' : 'error', message: shopFeedbackMessage(language, result) });
                              }}
                            >
                              {t(language, 'common.buy')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {tab === 'ai-pack' ? (
                <div className="menu-shop-grid ai-pack">
                  {filteredAiPackOptions.map((option) => {
                    const owned = ownedAiPackSet.has(option.key);
                    const active = option.key === aiPackKey;
                    const previewing = option.key === activePreviewAiPackKey;
                    return (
                      <div
                        key={option.key}
                        className={`menu-shop-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
                        tabIndex={0}
                        onMouseEnter={() => setPreviewAiPackKey(option.key)}
                        onFocus={() => setPreviewAiPackKey(option.key)}
                        onClick={() => setPreviewAiPackKey(option.key)}
                        onKeyDown={(event) => handlePreviewCardKeyDown(event, () => setPreviewAiPackKey(option.key))}
                      >
                        <div className={`menu-ai-pack-preview tone-${option.previewTone} tier-${option.tier}`}>
                          {option.names.slice(0, 4).map((name, index) => (
                            <div key={`${option.key}-${name}`} className={`menu-ai-pack-preview-card tone-${option.previewTone} tier-${option.tier}`}>
                              <PlayerPortrait
                                player={{
                                  id: `${option.key}-${index}`,
                                  name,
                                  style: option.stylePlan[index % option.stylePlan.length] ?? 'balanced',
                                  isHuman: false,
                                  portraitKey: option.portraitKeys[index % option.portraitKeys.length],
                                }}
                                mood="calm"
                                size="seat"
                                variant="panel"
                              />
                              <span>{name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="menu-shop-copy">
                          <strong>{option.title}</strong>
                          <span>{option.starter ? t(language, 'common.free') : `${option.eyebrow} · ${option.unlockCost}`}</span>
                          <p>{option.description}</p>
                        </div>
                        <div className="menu-shop-foot">
                          <span className={`menu-portrait-price ${option.starter ? 'starter' : owned ? 'owned' : 'locked'}`}>
                            {active ? t(language, 'common.currentlyUsing') : owned ? t(language, 'common.owned') : option.starter ? t(language, 'common.free') : `${option.unlockCost}`}
                          </span>
                          {active ? (
                            <button className="btn mini" type="button" disabled>
                              {t(language, 'common.currentAiPack')}
                            </button>
                          ) : owned ? (
                            <button
                              className="btn mini primary"
                              type="button"
                              onClick={() => {
                                onChangeAiPackKey(option.key);
                                setFeedback({ tone: 'neutral', message: `${t(language, 'common.use')} ${option.title}` });
                              }}
                            >
                              {t(language, 'common.use')}
                            </button>
                          ) : (
                            <button
                              className="btn mini primary"
                              type="button"
                              disabled={availablePoints < option.unlockCost}
                              onClick={() => {
                                const result = onPurchaseAiPack(option.key);
                                setFeedback({ tone: result.ok ? 'neutral' : 'error', message: shopFeedbackMessage(language, result) });
                              }}
                            >
                              {t(language, 'common.buy')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {currentItemCount === 0 ? <div className="menu-shop-empty glass-panel">{t(language, 'shop.empty')}</div> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
