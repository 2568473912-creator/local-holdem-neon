import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { HandHistoryRecord, ReplayViewerState } from '../../types/replay';
import type { TimelineFilterTag } from '../../replay/replayAnalysis';
import { buildReplayKeyMoments, detectSuspiciousBluffLines, filterReplayEvents } from '../../replay/replayAnalysis';
import { CardView } from './CardView';
import { SeatPanel } from './SeatPanel';

interface ReplayViewerProps {
  record: HandHistoryRecord;
  viewer: ReplayViewerState;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
  onSetStep: (step: number) => void;
  onJumpStage: (stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown') => void;
}

interface SeatPosition {
  x: number;
  y: number;
}

function getSeatPositions(total: number): SeatPosition[] {
  const positions: SeatPosition[] = [];
  const radiusX = 42;
  const radiusY = 38;
  const start = 90;

  for (let i = 0; i < total; i += 1) {
    const angle = ((start + (360 / total) * i) * Math.PI) / 180;
    positions.push({
      x: 50 + Math.cos(angle) * radiusX,
      y: 50 + Math.sin(angle) * radiusY,
    });
  }

  return positions;
}

export function ReplayViewer({
  record,
  viewer,
  onBack,
  onPrev,
  onNext,
  onToggleAutoplay,
  onSetStep,
  onJumpStage,
}: ReplayViewerProps) {
  const [keyFilter, setKeyFilter] = useState<'all' | 'pressure' | 'bluff' | 'elimination' | 'settlement'>('all');
  const [pressureThresholdBB, setPressureThresholdBB] = useState(4);
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterTag[]>([]);
  const snapshot = record.snapshots[viewer.step] ?? record.snapshots[0];
  const maxStep = Math.max(0, record.snapshots.length - 1);
  const seatPositions = getSeatPositions(snapshot.players.length);

  const eventAtStep = record.events.find((event) => event.step === snapshot.step);
  const difficultyLabel = record.aiDifficulty === 'conservative' ? '保守' : record.aiDifficulty === 'aggressive' ? '激进' : '标准';
  const suspiciousBluffLines = useMemo(() => detectSuspiciousBluffLines(record), [record]);
  const replayInsights = useMemo(() => {
    const aiActions = record.actions.filter((action) => action.actorId !== 'P0');
    const aggressive = aiActions.filter((action) => action.actionType === 'bet' || action.actionType === 'raise' || action.actionType === 'all-in').length;
    const tagCounter = new Map<string, number>();
    for (const action of aiActions) {
      if (!action.teachingLabel) continue;
      tagCounter.set(action.teachingLabel, (tagCounter.get(action.teachingLabel) ?? 0) + 1);
    }
    const topTags = [...tagCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      aiActionCount: aiActions.length,
      aggressiveRate: aiActions.length > 0 ? Math.round((aggressive / aiActions.length) * 100) : 0,
      topTags,
      suspiciousBluffCount: suspiciousBluffLines.size,
    };
  }, [record.actions, suspiciousBluffLines.size]);
  const chipFlow = useMemo(() => {
    return record.participants
      .map((participant) => {
        const start = record.startingChips[participant.id] ?? 0;
        const end = record.endingChips[participant.id] ?? start;
        return {
          id: participant.id,
          name: participant.name,
          start,
          end,
          delta: end - start,
        };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [record.endingChips, record.participants, record.startingChips]);
  const keyMoments = useMemo(
    () => buildReplayKeyMoments(record, suspiciousBluffLines, pressureThresholdBB),
    [record, suspiciousBluffLines, pressureThresholdBB],
  );
  const filteredKeyMoments = useMemo(() => {
    if (keyFilter === 'all') {
      return keyMoments;
    }
    if (keyFilter === 'bluff') {
      return keyMoments.filter((moment) => moment.kind === 'bluff');
    }
    if (keyFilter === 'elimination') {
      return keyMoments.filter((moment) => moment.kind === 'elimination');
    }
    if (keyFilter === 'settlement') {
      return keyMoments.filter((moment) => moment.kind === 'settlement');
    }
    return keyMoments.filter((moment) => moment.kind === 'pressure');
  }, [keyFilter, keyMoments]);
  const timelineFilterSet = useMemo(() => new Set(timelineFilters), [timelineFilters]);
  const filteredTimelineEvents = useMemo(
    () => filterReplayEvents(record.events, timelineFilterSet, suspiciousBluffLines, record.blindInfo.bigBlind, pressureThresholdBB),
    [pressureThresholdBB, record.blindInfo.bigBlind, record.events, suspiciousBluffLines, timelineFilterSet],
  );

  const toggleTimelineFilter = (tag: TimelineFilterTag) => {
    setTimelineFilters((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  return (
    <main className="replay-screen">
      <section className="replay-top glass-panel">
        <div>
          <h2>手牌回放 · 第 {record.handId} 手</h2>
          <p>{new Date(record.timestamp).toLocaleString('zh-CN', { hour12: false })}</p>
          <p>
            模式：{record.gameMode === 'standard' ? '标准德州' : '短牌德州'} · AI 难度：{difficultyLabel}
          </p>
        </div>
        <div className="replay-head-actions">
          <button className="btn" onClick={onBack}>
            返回历史中心
          </button>
        </div>
      </section>

      <section className="replay-main">
        <div className="replay-table-panel glass-panel">
          <div className="replay-table-felt">
            <div className="board-area">
              <div className="board-title">公共牌</div>
              <div className="board-cards">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const card = snapshot.board[idx];
                  return <CardView key={`rp-board-${idx}-${card?.code ?? 'x'}`} card={card} hidden={!card} delay={idx * 0.04} />;
                })}
              </div>
            </div>

            <motion.div
              key={`replay-pot-${snapshot.totalPot}`}
              className="pot-display"
              initial={{ scale: 0.96, opacity: 0.55 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <span>底池</span>
              <strong>{snapshot.totalPot}</strong>
            </motion.div>

            {snapshot.players.map((player, idx) => {
              const pos = seatPositions[idx];
              const seatPlayer = record.participants.find((p) => p.id === player.id);
              return (
                <div key={`replay-seat-${player.id}`} className="seat-anchor" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                  <SeatPanel
                    player={{
                      ...player,
                      isHuman: player.id === 'P0',
                      style: seatPlayer?.style ?? 'balanced',
                      committed: 0,
                      actedThisStreet: false,
                    }}
                    isDealer={record.dealerSeat === player.seat}
                    isSmallBlind={record.smallBlindSeat === player.seat}
                    isBigBlind={record.bigBlindSeat === player.seat}
                    isActive={snapshot.activePlayerId === player.id}
                    showHoleCards={player.id === 'P0' || player.revealed}
                  />
                </div>
              );
            })}
          </div>

          <div className="replay-controls">
            <button className="btn" onClick={onPrev} disabled={viewer.step <= 0}>
              上一步
            </button>
            <button className="btn" onClick={onToggleAutoplay}>
              {viewer.autoplay ? '暂停' : '自动播放'}
            </button>
            <button className="btn" onClick={onNext} disabled={viewer.step >= maxStep}>
              下一步
            </button>
            <div className="replay-stage-jumps">
              <button className="btn mini" onClick={() => onJumpStage('preflop')}>
                翻前
              </button>
              <button className="btn mini" onClick={() => onJumpStage('flop')}>
                翻牌
              </button>
              <button className="btn mini" onClick={() => onJumpStage('turn')}>
                转牌
              </button>
              <button className="btn mini" onClick={() => onJumpStage('river')}>
                河牌
              </button>
              <button className="btn mini" onClick={() => onJumpStage('showdown')}>
                摊牌
              </button>
            </div>
            <div className="replay-slider-row">
              <input
                type="range"
                min={0}
                max={maxStep}
                value={viewer.step}
                onChange={(event) => onSetStep(Number(event.target.value))}
              />
              <span>
                步骤 {viewer.step}/{maxStep}
              </span>
            </div>
          </div>
        </div>

        <aside className="replay-timeline glass-panel">
          <h3>事件时间线</h3>
          <p>当前：{snapshot.note}</p>
          {eventAtStep && <p>事件：{eventAtStep.note}</p>}
          <div className="replay-insights">
            <div>
              <span>AI 行动数</span>
              <strong>{replayInsights.aiActionCount}</strong>
            </div>
            <div>
              <span>进攻率</span>
              <strong>{replayInsights.aggressiveRate}%</strong>
            </div>
            <div>
              <span>高频教学标签</span>
              <strong>{replayInsights.topTags.map((item) => `${item[0]}(${item[1]})`).join(' / ') || '无'}</strong>
            </div>
            <div>
              <span>可疑诈唬线</span>
              <strong>{replayInsights.suspiciousBluffCount}</strong>
            </div>
          </div>
          <div className="replay-chip-flow">
            <h4>筹码变化</h4>
            <ul>
              {chipFlow.map((item) => (
                <li key={`flow-${item.id}`}>
                  <div>
                    <span>{item.name}</span>
                    <span>
                      {item.start} → {item.end}
                    </span>
                  </div>
                  <strong className={item.delta >= 0 ? 'up' : 'down'}>
                    {item.delta >= 0 ? '+' : ''}
                    {item.delta}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="replay-key-events">
            <div className="replay-key-head">
              <h4>关键节点</h4>
              <div className="replay-key-filter">
                <button className={keyFilter === 'all' ? 'active' : ''} onClick={() => setKeyFilter('all')} type="button">
                  全部
                </button>
                <button className={keyFilter === 'pressure' ? 'active' : ''} onClick={() => setKeyFilter('pressure')} type="button">
                  高压
                </button>
                <button className={keyFilter === 'bluff' ? 'active' : ''} onClick={() => setKeyFilter('bluff')} type="button">
                  诈唬线
                </button>
                <button className={keyFilter === 'elimination' ? 'active' : ''} onClick={() => setKeyFilter('elimination')} type="button">
                  淘汰
                </button>
                <button className={keyFilter === 'settlement' ? 'active' : ''} onClick={() => setKeyFilter('settlement')} type="button">
                  结算
                </button>
              </div>
            </div>
            <div className="replay-threshold-row">
              <span>高压阈值</span>
              <div className="replay-key-filter">
                {[2, 4, 6, 8, 10].map((bb) => (
                  <button
                    key={`bb-${bb}`}
                    className={pressureThresholdBB === bb ? 'active' : ''}
                    onClick={() => setPressureThresholdBB(bb)}
                    type="button"
                  >
                    {bb}BB
                  </button>
                ))}
              </div>
            </div>
            <div className="replay-key-list">
              {filteredKeyMoments.length === 0 ? (
                <span className="replay-key-empty">本手暂无关键节点</span>
              ) : (
                filteredKeyMoments.map((moment) => (
                  <button
                    key={`km-${moment.step}-${moment.label}`}
                    className={moment.step === snapshot.step ? 'active' : ''}
                    onClick={() => onSetStep(moment.step)}
                  >
                    <span>#{moment.step} {moment.label}</span>
                    <span>{moment.note}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          {eventAtStep?.type === 'action' && eventAtStep.teachingLabel && (
            <p className="replay-teaching-current">
              教学标签：<strong>{eventAtStep.teachingLabel}</strong>
              {eventAtStep.teachingNote ? ` · ${eventAtStep.teachingNote}` : ''}
            </p>
          )}
          <div className="replay-timeline-filters">
            <span>时间线筛选</span>
            <div className="replay-key-filter">
              <button className={timelineFilterSet.has('pressure') ? 'active' : ''} onClick={() => toggleTimelineFilter('pressure')} type="button">
                高压
              </button>
              <button className={timelineFilterSet.has('bluff') ? 'active' : ''} onClick={() => toggleTimelineFilter('bluff')} type="button">
                诈唬
              </button>
              <button className={timelineFilterSet.has('elimination') ? 'active' : ''} onClick={() => toggleTimelineFilter('elimination')} type="button">
                淘汰
              </button>
              <button className={timelineFilterSet.has('teaching') ? 'active' : ''} onClick={() => toggleTimelineFilter('teaching')} type="button">
                教学
              </button>
              <button className={timelineFilterSet.has('showdown') ? 'active' : ''} onClick={() => toggleTimelineFilter('showdown')} type="button">
                摊牌
              </button>
            </div>
            <strong>
              事件 {filteredTimelineEvents.length}/{record.events.length}
            </strong>
          </div>
          {filteredTimelineEvents.length === 0 ? (
            <p className="replay-timeline-empty">当前筛选下无事件</p>
          ) : (
            <ul>
              {filteredTimelineEvents.map((event) => (
                <li key={event.id} className={event.step === snapshot.step ? 'active' : ''}>
                  <button onClick={() => onSetStep(event.step)}>
                    <span>#{event.step}</span>
                    <span className="timeline-event-main">{event.note}</span>
                    {event.type === 'action' && event.teachingLabel && (
                      <span className={`timeline-teaching ${event.teachingTag ?? ''}`}>{event.teachingLabel}</span>
                    )}
                    {suspiciousBluffLines.has(event.step) && <span className="timeline-flag bluff">可疑诈唬</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </main>
  );
}
