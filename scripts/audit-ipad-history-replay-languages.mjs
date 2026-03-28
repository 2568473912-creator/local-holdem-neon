import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/Users/klaywei/Documents/local-holdem-neon/output/ipad-history-replay-language-audit';
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1024),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 768),
};
const LANGUAGES = (process.env.AUDIT_LANGS ?? 'fr,de,ja')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const SESSION_DETAIL_OVERFLOW_SELECTORS = [
  '.session-detail-head strong',
  '.session-detail-head span',
  '.session-detail-grid strong',
  '.session-detail-grid span',
  '.session-detail-meta span',
  '.session-filter-chip',
  '.session-detail-marker-strip span',
  '.session-detail-overview-callout strong',
  '.session-detail-overview-callout span',
  '.session-detail-list li strong',
  '.session-detail-list li span',
  '.session-detail-tag',
  '.session-detail-jump',
  '.session-compare-head strong',
  '.session-compare-head span',
  '.session-compare-digest-head strong',
  '.session-compare-digest-item span',
  '.session-compare-digest-item strong',
  '.session-compare-digest-empty',
  '.session-compare-summary-chip span',
  '.session-compare-card strong',
  '.session-compare-card span',
  '.session-compare-actions .btn',
];
const REPLAY_INSIGHT_OVERFLOW_SELECTORS = [
  '.replay-sidebar-head strong',
  '.replay-sidebar-head p',
  '.replay-insight-layer-switch .history-view-button',
  '.replay-insights strong',
  '.replay-insights span',
  '.replay-insight-summary-card span',
  '.replay-insight-summary-card strong',
  '.replay-key-controls-compact span',
  '.replay-key-controls-actions .btn',
  '.replay-key-filter-secondary button',
  '.replay-chip-flow li',
  '.replay-key-list button',
  '.replay-section-summary',
  '.replay-teaching-current',
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function screenshot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, name), fullPage: true });
}

async function countOverflow(page, selectors) {
  return page.evaluate((inputSelectors) => {
    const results = [];
    for (const selector of inputSelectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const element = node;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
        const xOverflow = element.scrollWidth - element.clientWidth > 2;
        const yOverflow = element.scrollHeight - element.clientHeight > 2;
        if (xOverflow || yOverflow) {
          results.push({
            selector,
            text: element.textContent?.trim() ?? '',
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          });
        }
      });
    }
    return results;
  }, selectors);
}

async function findLiteralLeaks(page, selectors) {
  return page.evaluate((inputSelectors) => {
    const leakPattern = /\b(?:null|undefined)\b/i;
    const results = [];
    for (const selector of inputSelectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const element = node;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const text = element.textContent?.trim() ?? '';
        if (
          !text ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          !leakPattern.test(text)
        ) {
          return;
        }
        results.push({
          selector,
          text,
        });
      });
    }
    return results;
  }, selectors);
}

async function waitForLanguage(page, language) {
  await page.waitForFunction(
    (nextLanguage) => {
      const payload = window.render_game_to_text ? JSON.parse(window.render_game_to_text()) : null;
      return payload?.language?.key === nextLanguage;
    },
    language,
    { timeout: 5000 },
  );
}

async function openHistoryFromRecentHands(page) {
  await page.waitForFunction(() => typeof window.__neonDebug?.prepareHoldemHistoryAudit === 'function', null, { timeout: 10000 });
  await page.evaluate(async () => {
    await window.__neonDebug?.prepareHoldemHistoryAudit?.({ hands: 2, openHistory: true });
  });
  await page.waitForSelector('.history-screen');
}

async function runLanguageAudit(browser, language) {
  const outDir = path.join(OUTPUT_DIR, language);
  await ensureDir(outDir);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: language === 'ja' ? 'ja-JP' : language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console:${msg.text()}`);
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.selectOption('.language-switcher select', language);
  await waitForLanguage(page, language);

  await openHistoryFromRecentHands(page);

  const historyHandsOverflow = await countOverflow(page, [
    '.history-head-block h2',
    '.history-view-button',
    '.history-analysis strong',
    '.history-analysis span',
    '.history-list li strong',
    '.history-list li span',
    '.history-list .btn',
  ]);
  const historyHandsLeaks = await findLiteralLeaks(page, ['.history-screen']);
  await screenshot(page, outDir, 'history-hands.png');

  await page.click('.history-view-button:last-child');
  await page.waitForSelector('.session-archive-layout');
  await page.waitForSelector('.career-center', { timeout: 4000 });
  await page.waitForTimeout(250);

  const historySessionsOverflow = await countOverflow(page, [
    '.session-archive-board strong',
    '.session-archive-board span',
    '.session-archive-layout strong',
    '.session-archive-layout span',
    '.session-filter-chip',
    '.session-detail-jump',
    '.session-detail-tag',
    '.career-center-head h3',
    '.career-center-actions .btn',
  ]);
  const historySessionsLeaks = await findLiteralLeaks(page, ['.history-screen']);
  const sessionDetailTabAudits = [];
  let compareDigestFieldFocus = null;
  const sessionDetailButtons = page.locator('.session-detail-panel-button');
  const sessionDetailTabCount = await sessionDetailButtons.count();
  if (sessionDetailTabCount > 0) {
    for (let index = 0; index < sessionDetailTabCount; index += 1) {
      const button = sessionDetailButtons.nth(index);
      const label = (await button.textContent())?.trim() ?? `detail-${index + 1}`;
      await button.click();
      await page.waitForTimeout(180);
      const overflow = await countOverflow(page, SESSION_DETAIL_OVERFLOW_SELECTORS);
      const leaks = await findLiteralLeaks(page, ['.session-detail-panel-shell']);
      historySessionsOverflow.push(...overflow.map((item) => ({ ...item, detailTab: label })));
      historySessionsLeaks.push(...leaks.map((item) => ({ ...item, detailTab: label })));
      sessionDetailTabAudits.push({
        label,
        state: 'empty',
        overflowCount: overflow.length,
        leakCount: leaks.length,
      });
    }

    if (sessionDetailTabCount > 1) {
      await sessionDetailButtons.nth(1).click();
      await page.waitForTimeout(180);
      const compareActionButtons = page.locator('.session-detail-hand-side > .btn:first-of-type');
      const compareActionCount = await compareActionButtons.count();
      if (compareActionCount > 0) {
        for (let compareIndex = 0; compareIndex < Math.min(2, compareActionCount); compareIndex += 1) {
          await compareActionButtons.nth(compareIndex).click();
          await page.waitForTimeout(220);
        }
        const compareButton = sessionDetailButtons.nth(sessionDetailTabCount - 1);
        const compareLabel = (await compareButton.textContent())?.trim() ?? 'compare';
        await compareButton.click();
        await page.waitForTimeout(180);
        const compareOverflow = await countOverflow(page, SESSION_DETAIL_OVERFLOW_SELECTORS);
        const compareLeaks = await findLiteralLeaks(page, ['.session-detail-panel-shell']);
        historySessionsOverflow.push(...compareOverflow.map((item) => ({ ...item, detailTab: compareLabel, detailState: 'filled' })));
        historySessionsLeaks.push(...compareLeaks.map((item) => ({ ...item, detailTab: compareLabel, detailState: 'filled' })));
        sessionDetailTabAudits.push({
          label: compareLabel,
          state: 'filled',
          overflowCount: compareOverflow.length,
          leakCount: compareLeaks.length,
        });
        await screenshot(page, outDir, 'history-sessions-compare.png');
        const compareDigestButton = page.locator('.session-compare-digest-button').first();
        if (await compareDigestButton.count()) {
          await compareDigestButton.click();
          await page.waitForTimeout(180);
          compareDigestFieldFocus = {
            focusedFields: await page.locator('.session-compare-field.digest-focused').count(),
            dimmedFields: await page.locator('.session-compare-field.digest-dimmed').count(),
            focusedSummary: await page.locator('.session-compare-summary-chip.digest-focused').count(),
          };
          await screenshot(page, outDir, 'history-sessions-compare-focused.png');
        }
      }
    }

    await sessionDetailButtons.first().click();
    await page.waitForTimeout(180);
  }
  await screenshot(page, outDir, 'history-sessions.png');

  const careerToggle = page.locator('.career-center .section-inline-toggle');
  if (await careerToggle.count()) {
    await careerToggle.click();
    await page.waitForTimeout(400);
  }

  await screenshot(page, outDir, 'history-sessions-expanded.png');

  const expandedSessionSelectors = [
    '.career-center-head h3',
    '.career-center-head span',
    '.career-center-grid strong',
    '.career-center-grid span',
    '.career-center-mode-card strong',
    '.career-center-mode-card span',
    '.career-center-mode-card em',
    '.career-center-mode-card b',
    '.career-center-recent li strong',
    '.career-center-recent li span',
    '.session-detail-list li strong',
    '.session-detail-list li span',
  ];
  let historySessionsExpandedOverflow = [];
  let historySessionsExpandedLeaks = [];
  const careerSectionAudits = [];
  const careerSectionButtons = page.locator('.career-center-panel-button');
  const careerSectionCount = await careerSectionButtons.count();

  if (careerSectionCount > 0) {
    for (let index = 0; index < careerSectionCount; index += 1) {
      const button = careerSectionButtons.nth(index);
      const label = (await button.textContent())?.trim() ?? `section-${index + 1}`;
      await button.click();
      await page.waitForTimeout(180);
      const overflow = await countOverflow(page, expandedSessionSelectors);
      const leaks = await findLiteralLeaks(page, ['.career-center-section-shell']);
      historySessionsExpandedOverflow.push(...overflow.map((item) => ({ ...item, section: label })));
      historySessionsExpandedLeaks.push(...leaks.map((item) => ({ ...item, section: label })));
      careerSectionAudits.push({
        label,
        overflowCount: overflow.length,
        leakCount: leaks.length,
      });
    }
  } else {
    historySessionsExpandedOverflow = await countOverflow(page, expandedSessionSelectors);
    historySessionsExpandedLeaks = await findLiteralLeaks(page, ['.history-screen']);
  }

  await page.click('.history-view-button:first-child');
  await page.waitForSelector('.history-list');
  await page.click('.history-list .btn.primary');
  await page.waitForSelector('.replay-screen');

  const replayTimelineOverflow = await countOverflow(page, [
    '.replay-top h2',
    '.replay-top p',
    '.replay-controls .btn',
    '.replay-stage-jumps .btn',
    '.replay-sidebar-head strong',
    '.replay-sidebar-head p',
    '.replay-timeline li button',
    '.timeline-event-main',
    '.timeline-teaching',
    '.timeline-flag',
  ]);
  const replayTimelineLeaks = await findLiteralLeaks(page, ['.replay-screen']);
  await screenshot(page, outDir, 'replay-timeline.png');

  await page.click('.replay-view-switch .history-view-button:last-child');
  await page.waitForTimeout(250);
  let replayInsightsOverflow = [];
  let replayInsightsLeaks = [];
  let replayInsightTimelineLinked = false;
  const replayInsightPanelAudits = [];
  const replayInsightPanelButtons = page.locator('.replay-insight-layer-switch .history-view-button');
  const replayInsightPanelCount = await replayInsightPanelButtons.count();

  if (replayInsightPanelCount > 0) {
    for (let index = 0; index < replayInsightPanelCount; index += 1) {
      const button = replayInsightPanelButtons.nth(index);
      const label = (await button.textContent())?.trim() ?? `insight-${index + 1}`;
      await button.click();
      await page.waitForTimeout(180);
      const overflow = await countOverflow(page, REPLAY_INSIGHT_OVERFLOW_SELECTORS);
      const leaks = await findLiteralLeaks(page, ['.replay-insight-pane']);
      replayInsightsOverflow.push(...overflow.map((item) => ({ ...item, panel: label })));
      replayInsightsLeaks.push(...leaks.map((item) => ({ ...item, panel: label })));
      replayInsightPanelAudits.push({
        label,
        overflowCount: overflow.length,
        leakCount: leaks.length,
      });
      if (index === 0) {
        await screenshot(page, outDir, 'replay-insights.png');
      } else {
        const advancedButton = page.locator('.replay-key-controls-actions .section-inline-toggle').first();
        if (await advancedButton.count()) {
          await advancedButton.click();
          await page.waitForTimeout(180);
        }
        const insightJumpButton = page.locator('.replay-key-list button').first();
        if (await insightJumpButton.count()) {
          await insightJumpButton.click();
          await page.waitForTimeout(220);
          replayInsightTimelineLinked = await page
            .locator('.replay-view-switch .history-view-button')
            .first()
            .evaluate((node) => node.classList.contains('active'));
          await screenshot(page, outDir, 'replay-insights-linked.png');
          await page.click('.replay-view-switch .history-view-button:last-child');
          await page.waitForTimeout(180);
        }
        await screenshot(page, outDir, 'replay-insights-deep.png');
      }
    }
  } else {
    replayInsightsOverflow = await countOverflow(page, REPLAY_INSIGHT_OVERFLOW_SELECTORS);
    replayInsightsLeaks = await findLiteralLeaks(page, ['.replay-screen']);
    await screenshot(page, outDir, 'replay-insights.png');
  }

  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const replaySwitchLabels = await page.locator('.replay-view-switch .history-view-button').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? ''),
  );

  await context.close();

  return {
    language,
    errors,
    replaySwitchLabels,
    counts: {
      historyHands: historyHandsOverflow.length,
      historyHandsLeaks: historyHandsLeaks.length,
      historySessions: historySessionsOverflow.length,
      historySessionsLeaks: historySessionsLeaks.length,
      historySessionsExpanded: historySessionsExpandedOverflow.length,
      historySessionsExpandedLeaks: historySessionsExpandedLeaks.length,
      replayTimeline: replayTimelineOverflow.length,
      replayTimelineLeaks: replayTimelineLeaks.length,
      replayInsights: replayInsightsOverflow.length,
      replayInsightsLeaks: replayInsightsLeaks.length,
    },
    historyHandsOverflow,
    historyHandsLeaks,
    historySessionsOverflow,
    historySessionsLeaks,
    historySessionsExpandedOverflow,
    historySessionsExpandedLeaks,
    careerSectionAudits,
    sessionDetailTabAudits,
    compareDigestFieldFocus,
    replayInsightPanelAudits,
    replayInsightTimelineLinked,
    replayTimelineOverflow,
    replayTimelineLeaks,
    replayInsightsOverflow,
    replayInsightsLeaks,
    finalState,
  };
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const summaries = [];
  for (const language of LANGUAGES) {
    summaries.push(await runLanguageAudit(browser, language));
  }
  await browser.close();

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'summary.json'),
    JSON.stringify(
      {
        appUrl: APP_URL,
        viewport: VIEWPORT,
        languages: LANGUAGES,
        summaries,
      },
      null,
      2,
    ),
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
