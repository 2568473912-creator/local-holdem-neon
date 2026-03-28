import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/Users/klaywei/Documents/local-holdem-neon/output/ipad-holdem-stages';
const URL = process.env.APP_URL ?? 'http://127.0.0.1:4173/';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function dumpJson(name, payload) {
  await fs.writeFile(path.join(OUTPUT_DIR, name), JSON.stringify(payload, null, 2), 'utf8');
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true });
}

async function readState(page) {
  return page.evaluate(() => {
    const text = window.render_game_to_text?.();
    return text ? JSON.parse(text) : null;
  });
}

async function advance(page, ms = 1400) {
  await page.evaluate((delay) => window.advanceTime?.(delay), ms);
  await page.waitForTimeout(180);
}

async function setAiCount(page, count) {
  await page.evaluate((nextCount) => {
    const labels = [...document.querySelectorAll('label')];
    const aiCountLabel = labels.find((node) => node.textContent?.includes('AI 人数'));
    const range = aiCountLabel?.querySelector('input[type="range"]');
    if (!range) return;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(range, String(nextCount));
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  }, count);
}

async function capturePanelSnapshot(page, stage) {
  const payload = await page.evaluate(() => {
    const decisionFacts = [...document.querySelectorAll('.controls-decision-facts div')].map((node) => ({
      label: node.querySelector('span')?.textContent?.trim() ?? '',
      value: node.querySelector('strong')?.textContent?.trim() ?? '',
    }));
    const miniStats = [...document.querySelectorAll('.controls-mini-stats div')].map((node) => ({
      label: node.querySelector('span')?.textContent?.trim() ?? '',
      value: node.querySelector('strong')?.textContent?.trim() ?? '',
    }));
    const recommendation = document.querySelector('.controls-decision-copy strong')?.textContent?.trim() ?? '';
    return {
      recommendation,
      decisionFacts,
      miniStats,
    };
  });
  await screenshot(page, `${stage}.png`);
  await dumpJson(`${stage}.json`, payload);
  return payload;
}

async function playHeroSafeAction(page) {
  const checkButton = page.getByRole('button', { name: '过牌' });
  if (await checkButton.isVisible().catch(() => false) && !(await checkButton.isDisabled().catch(() => true))) {
    await checkButton.click();
    await page.waitForTimeout(220);
    return true;
  }

  const callButton = page.locator('.controls-panel .btn.action').filter({ hasText: /跟注/ }).first();
  if (await callButton.isVisible().catch(() => false) && !(await callButton.isDisabled().catch(() => true))) {
    await callButton.click();
    await page.waitForTimeout(220);
    return true;
  }

  return false;
}

async function collectStageSnapshots(page) {
  const targets = ['preflop', 'flop', 'turn', 'river'];
  const captures = {};
  let handAttempts = 0;
  let loopGuard = 0;

  while (Object.keys(captures).length < targets.length && handAttempts < 6 && loopGuard < 240) {
    loopGuard += 1;
    const state = await readState(page);
    if (!state || state.screen !== 'table') break;

    const stage = state.table?.stage;
    const heroTurn = stage && state.table?.activePlayerId === 'P0' && stage !== 'complete';

    if (heroTurn && targets.includes(stage) && !captures[stage]) {
      captures[stage] = await capturePanelSnapshot(page, stage);
    }

    if (stage === 'complete') {
      handAttempts += 1;
      const nextHandButton = page.getByRole('button', { name: /确认继续|下一手/ }).first();
      if (await nextHandButton.isVisible().catch(() => false)) {
        await nextHandButton.click();
        await page.waitForTimeout(400);
      } else {
        const menuButton = page.getByRole('button', { name: '返回菜单' }).first();
        if (await menuButton.isVisible().catch(() => false)) {
          break;
        }
      }
      await advance(page, 1800);
      continue;
    }

    if (heroTurn) {
      const acted = await playHeroSafeAction(page);
      if (!acted) {
        await advance(page, 1200);
      }
    } else {
      await advance(page, 1600);
    }
  }

  return captures;
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '进入冠军桌·德州' }).click();
  await page.getByRole('heading', { name: '冠军桌·德州' }).waitFor();
  await setAiCount(page, 1);
  await page.waitForTimeout(180);
  await page.getByRole('button', { name: '开始游戏' }).click();
  await page.waitForSelector('.controls-panel', { timeout: 15000 });

  const captures = await collectStageSnapshots(page);
  const finalState = await readState(page);

  await dumpJson('summary.json', {
    capturedStages: Object.keys(captures),
    captures,
    finalState,
    missingStages: ['preflop', 'flop', 'turn', 'river'].filter((stage) => !captures[stage]),
  });

  await browser.close();
}

main().catch(async (error) => {
  await ensureDir(OUTPUT_DIR);
  await fs.writeFile(path.join(OUTPUT_DIR, 'error.txt'), `${error.stack ?? error}\n`, 'utf8');
  process.exitCode = 1;
});
