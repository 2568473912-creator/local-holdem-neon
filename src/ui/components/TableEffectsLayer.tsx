import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { HandStage } from '../../types/game';
import type { MotionLevel } from '../../state/motionPreferences';
import type { EffectSkinKey } from '../../types/effectSkin';
import type { AppLanguage } from '../../i18n';

interface TableEffectsLayerProps {
  language: AppLanguage;
  handId: number;
  boardCount: number;
  totalPot: number;
  stage: HandStage;
  winnerCount: number;
  motionLevel: MotionLevel;
  effectSkinKey: EffectSkinKey;
  stabilized?: boolean;
}

function boardBurstLabel(boardCount: number, language: AppLanguage): string {
  if (language === 'zh-CN') {
    if (boardCount === 3) return '翻牌落桌';
    if (boardCount === 4) return '转牌揭示';
    return '河牌揭示';
  }
  if (language === 'ja') {
    if (boardCount === 3) return 'フロップ公開';
    if (boardCount === 4) return 'ターン公開';
    return 'リバー公開';
  }
  if (language === 'fr') {
    if (boardCount === 3) return 'Flop révélé';
    if (boardCount === 4) return 'Turn révélé';
    return 'River révélé';
  }
  if (language === 'de') {
    if (boardCount === 3) return 'Flop aufgedeckt';
    if (boardCount === 4) return 'Turn aufgedeckt';
    return 'River aufgedeckt';
  }
  if (boardCount === 3) return 'Flop revealed';
  if (boardCount === 4) return 'Turn revealed';
  return 'River revealed';
}

export function TableEffectsLayer({ language, handId, boardCount, totalPot, stage, winnerCount, motionLevel, effectSkinKey, stabilized = false }: TableEffectsLayerProps) {
  const reducedMotion = motionLevel === 'reduced' || stabilized;
  const softMotion = motionLevel === 'soft';
  const ambientOrbs = useMemo(
    () =>
      reducedMotion
        ? []
        : [
            { key: 'a', left: '18%', top: '26%', size: 120, delay: 0.2, duration: 7.8 },
            { key: 'b', left: '77%', top: '20%', size: 94, delay: 1.4, duration: 6.9 },
            ...(softMotion || stabilized ? [] : [{ key: 'c', left: '28%', top: '77%', size: 86, delay: 0.9, duration: 8.8 }]),
            ...(softMotion || stabilized ? [] : [{ key: 'd', left: '71%', top: '72%', size: 118, delay: 1.8, duration: 7.2 }]),
          ],
    [reducedMotion, softMotion, stabilized],
  );
  const boardParticles = useMemo(
    () =>
      Array.from({ length: reducedMotion ? 0 : softMotion || stabilized ? 0 : 6 }, (_, index) => ({
        key: `board-${index}`,
        x: (index - 2.5) * 20,
        y: index % 2 === 0 ? -44 : 44,
        delay: index * 0.03,
      })),
    [reducedMotion, softMotion, stabilized],
  );
  const potParticles = useMemo(
    () =>
      Array.from({ length: reducedMotion ? 0 : softMotion || stabilized ? 0 : 7 }, (_, index) => ({
        key: `pot-${index}`,
        x: Math.cos((index / 7) * Math.PI * 2) * 48,
        y: Math.sin((index / 7) * Math.PI * 2) * 34,
        delay: index * 0.025,
      })),
    [reducedMotion, softMotion, stabilized],
  );

  return (
    <div className={`table-effects-layer fx-style-${effectSkinKey}`} aria-hidden="true">
      {motionLevel !== 'reduced' && (
        <div className="table-skin-ambient">
          <span className="skin-flame skin-flame-1" />
          <span className="skin-flame skin-flame-2" />
          <span className="skin-flame skin-flame-3" />
          <span className="skin-flame skin-flame-4" />
          <span className="skin-flame skin-flame-5" />
          <span className="skin-wave skin-wave-1" />
          <span className="skin-wave skin-wave-2" />
          <span className="skin-wave skin-wave-3" />
          <span className="skin-breeze skin-breeze-1" />
          <span className="skin-breeze skin-breeze-2" />
          <span className="skin-breeze skin-breeze-3" />
          <span className="skin-comet skin-comet-1" />
          <span className="skin-comet skin-comet-2" />
          <span className="skin-sparkle skin-sparkle-1" />
          <span className="skin-sparkle skin-sparkle-2" />
          <span className="skin-sparkle skin-sparkle-3" />
          <span className="skin-sparkle skin-sparkle-4" />
          <span className="skin-prism skin-prism-1" />
          <span className="skin-prism skin-prism-2" />
        </div>
      )}
      <div className="table-ambient-effects">
        {ambientOrbs.map((orb) => (
          <motion.span
            key={orb.key}
            className="table-ambient-orb"
            style={{ left: orb.left, top: orb.top, width: orb.size, height: orb.size }}
            animate={{
              x: [0, 10, -8, 0],
              y: [0, -8, 6, 0],
              opacity: [0.2, 0.45, 0.24, 0.2],
              scale: [1, 1.06, 0.98, 1],
            }}
            transition={{
              duration: softMotion ? orb.duration - 1.1 : orb.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: orb.delay,
            }}
          />
        ))}
      </div>

      {boardCount > 0 && (
        <motion.div
          key={`board-burst-${handId}-${boardCount}`}
          className="table-fx board-fx"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: [0, 1, 0], scale: [0.86, 1, 1.08] }}
          transition={{ duration: softMotion ? 0.56 : 0.74, ease: 'easeOut' }}
        >
          <motion.div className="table-fx-ring board-fx-ring" initial={{ scale: 0.72, opacity: 0.72 }} animate={{ scale: 1.12, opacity: 0 }} transition={{ duration: softMotion ? 0.54 : 0.72 }} />
          <div className="table-fx-label">{boardBurstLabel(boardCount, language)}</div>
          {boardParticles.map((particle) => (
            <motion.span
              key={`${handId}-${boardCount}-${particle.key}`}
              className="table-fx-particle board"
              initial={{ x: 0, y: 0, opacity: 0.8, scale: 0.8 }}
              animate={{ x: particle.x, y: particle.y, opacity: 0, scale: 1.2 }}
              transition={{ duration: softMotion ? 0.48 : 0.66, ease: 'easeOut', delay: particle.delay }}
            />
          ))}
        </motion.div>
      )}

      {stage === 'showdown' && (
        <motion.div
          key={`showdown-fx-${handId}`}
          className="table-fx showdown-fx"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: [0, 1, 0], scale: [0.88, 1, 1.06] }}
          transition={{ duration: softMotion ? 0.6 : 0.82, ease: 'easeOut' }}
        >
          <motion.div className="table-fx-ring showdown-fx-ring" initial={{ scale: 0.76, opacity: 0.72 }} animate={{ scale: 1.18, opacity: 0 }} transition={{ duration: softMotion ? 0.58 : 0.78 }} />
          <motion.div className="table-fx-label showdown-fx-label" initial={{ y: 10, opacity: 0 }} animate={{ y: [10, 0, -8], opacity: [0, 1, 0] }} transition={{ duration: softMotion ? 0.56 : 0.74, ease: 'easeOut' }}>
            {language === 'zh-CN' ? '摊牌对决' : language === 'ja' ? 'ショーダウン' : language === 'fr' ? 'Abattage' : language === 'de' ? 'Showdown' : 'Showdown'}
          </motion.div>
        </motion.div>
      )}

      {totalPot > 0 && !stabilized && (
        <motion.div
          key={`pot-burst-${handId}-${totalPot}`}
          className="table-fx pot-fx"
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: [0, 1, 0], scale: [0.78, 1, 1.06] }}
          transition={{ duration: softMotion ? 0.5 : 0.66, ease: 'easeOut' }}
        >
          <motion.div className="table-fx-ring pot-fx-ring" initial={{ scale: 0.74, opacity: 0.78 }} animate={{ scale: 1.16, opacity: 0 }} transition={{ duration: softMotion ? 0.48 : 0.64 }} />
          <motion.div className="table-fx-pot-delta" initial={{ y: 6, opacity: 0 }} animate={{ y: [-2, -10, -18], opacity: [0, 1, 0] }} transition={{ duration: softMotion ? 0.46 : 0.6 }}>
            {language === 'zh-CN' ? '筹码入池' : language === 'ja' ? 'チップ投入' : language === 'fr' ? 'Jetons au pot' : language === 'de' ? 'Chips in den Pot' : 'Chips to pot'}
          </motion.div>
          {potParticles.map((particle) => (
            <motion.span
              key={`${handId}-${totalPot}-${particle.key}`}
              className="table-fx-particle pot"
              initial={{ x: 0, y: 0, opacity: 0.7, scale: 0.9 }}
              animate={{ x: particle.x, y: particle.y, opacity: 0, scale: 1.16 }}
              transition={{ duration: softMotion ? 0.42 : 0.58, ease: 'easeOut', delay: particle.delay }}
            />
          ))}
        </motion.div>
      )}

      {!reducedMotion && stage === 'complete' && winnerCount > 0 && (
        <motion.div
          key={`winner-sweep-${handId}`}
          className="table-fx winner-sweep"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: softMotion ? 0.78 : 1.02 }}
        >
          <motion.span
            className="winner-sweep-beam"
            initial={{ x: '140%' }}
            animate={{ x: '-140%' }}
            transition={{ duration: softMotion ? 0.88 : 1.15, ease: 'easeInOut' }}
          />
          <motion.span
            className="winner-sweep-halo"
            initial={{ opacity: 0.3, scale: 0.94 }}
            animate={{ opacity: [0.3, 0.92, 0], scale: [0.94, 1.08, 1.12] }}
            transition={{ duration: softMotion ? 0.62 : 0.82, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </div>
  );
}
