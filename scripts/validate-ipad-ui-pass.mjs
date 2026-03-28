import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/Users/klaywei/Documents/local-holdem-neon/output/ui-ipad-pass';
const URL = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const contextViewport = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1194),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 834),
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true });
}

async function dumpJson(name, payload) {
  await fs.writeFile(path.join(OUTPUT_DIR, name), JSON.stringify(payload, null, 2), 'utf8');
}

function centerDelta(box, viewport) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  return {
    x: Math.abs(x - viewport.width / 2),
    y: Math.abs(y - viewport.height / 2),
  };
}

async function countOverflow(page, selectors) {
  return page.evaluate((inputSelectors) => {
    const results = [];
    for (const selector of inputSelectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const element = node;
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

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDir(OUTPUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: contextViewport,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: 'zh-CN',
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

  await page.goto(URL, { waitUntil: 'networkidle' });

  const menuState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  await screenshot(page, 'menu.png');

  await page.getByRole('button', { name: '进入冠军桌·德州' }).click();
  await page.getByRole('heading', { name: '冠军桌·德州' }).waitFor();
  const menuBox = await page.locator('.holdem-menu-card').boundingBox();
  const pageViewport = page.viewportSize();
  const menuCenter = menuBox && pageViewport ? centerDelta(menuBox, pageViewport) : null;
  const appearancePillCount = await page.locator('.menu-preview-pills .menu-preview-pill').count();
  const appearanceExpandedBefore = await page.locator('.menu-store-summary').count();
  const appearanceToggle = page.locator('.menu-preview-head.with-toggle').first();
  if (await appearanceToggle.count()) {
    await appearanceToggle.click();
    await page.waitForTimeout(150);
  }
  const appearanceExpandedAfter = await page.locator('.menu-store-summary').count();
  await screenshot(page, 'holdem-menu.png');

  await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')];
    const aiCountLabel = labels.find((node) => node.textContent?.includes('AI 人数'));
    const range = aiCountLabel?.querySelector('input[type="range"]');
    if (range) {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(range, '1');
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('label')];
    const aiCountLabel = labels.find((node) => node.textContent?.includes('AI 人数'));
    const strong = aiCountLabel?.querySelector('strong');
    return strong?.textContent?.trim() === '1';
  });

  await page.getByRole('button', { name: '开始游戏' }).click();
  await page.waitForSelector('.top-hud');
  const holdemHud = await page.evaluate(() => {
    const hud = document.querySelector('.top-hud');
    const pills = [...document.querySelectorAll('.hud-center .hud-pill')].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        text: node.textContent?.trim() ?? '',
        top: rect.top,
        width: rect.width,
        height: rect.height,
        display: window.getComputedStyle(node).display,
      };
    });
    const visiblePills = pills.filter((pill) => pill.display !== 'none' && pill.width > 0 && pill.height > 0);
    const rows = [...new Set(visiblePills.map((pill) => pill.top.toFixed(2)))].length;
    return {
      height: hud?.getBoundingClientRect().height ?? 0,
      rows,
      pillCount: visiblePills.length,
      hiddenPillCount: pills.length - visiblePills.length,
    };
  });
  await page.locator('.top-hud .hud-more-info').click();
  await page.waitForSelector('.ipad-info-sheet');
  const infoBox = await page.locator('.ipad-info-sheet').boundingBox();
  const infoCenter = infoBox && pageViewport ? centerDelta(infoBox, pageViewport) : null;
  const holdemTextLeaks = await findLiteralLeaks(page, ['.top-hud', '.ipad-info-sheet']);
  await screenshot(page, 'holdem-info.png');
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  const controlsVisibleBeforeToggle = await page.locator('.controls-panel').isVisible().catch(() => false);
  if (!controlsVisibleBeforeToggle) {
    await page.getByRole('button', { name: /操作面板/ }).click();
  }
  await page.waitForSelector('.controls-panel');
  await page.waitForTimeout(180);
  const foldButton = page.getByRole('button', { name: '弃牌' });
  await foldButton.click();
  await page.waitForFunction(
    () => {
      const payload = window.render_game_to_text ? JSON.parse(window.render_game_to_text()) : null;
      return payload?.table?.stage === 'complete' || Boolean(document.querySelector('.settlement-spotlight'));
    },
    { timeout: 25000 },
  );
  await page.waitForSelector('.settlement-spotlight', { timeout: 5000 });
  const settlementBox = await page.locator('.settlement-spotlight').boundingBox();
  const settlementCenter = settlementBox && pageViewport ? centerDelta(settlementBox, pageViewport) : null;
  const settlementButtons = await page.locator('.settlement-actions .btn').count();
  await screenshot(page, 'holdem-settlement.png');
  await page.getByRole('button', { name: '返回菜单' }).click();
  await page.waitForSelector('.holdem-menu-card');
  await page.getByRole('button', { name: '返回模式大厅' }).click();
  await page.getByRole('heading', { name: '夜局' }).waitFor();

  await page.getByRole('button', { name: '进入抢地主·夜场' }).click();
  await page.getByRole('heading', { name: '抢地主·夜场' }).waitFor();
  await page.getByRole('button', { name: '开始斗地主' }).click();
  await page.waitForSelector('.ddz-table-screen');
  const ddzOverflow = await countOverflow(page, [
    '.ddz-current-play-head',
    '.ddz-seat-head strong',
    '.ddz-seat-meta',
    '.ddz-status-strip strong',
    '.ddz-human-selection-strip strong',
  ]);
  const ddzTextLeaks = await findLiteralLeaks(page, ['.ddz-table-screen']);
  await screenshot(page, 'doudizhu.png');
  await page.getByRole('button', { name: '大厅' }).click();
  await page.waitForSelector('.ddz-menu-card');
  await page.getByRole('button', { name: '返回模式大厅' }).click();
  await page.getByRole('heading', { name: '夜局' }).waitFor();

  await page.getByRole('button', { name: '进入升级场·掼蛋' }).click();
  await page.getByRole('heading', { name: '升级场·掼蛋' }).waitFor();
  await page.getByRole('button', { name: '开始掼蛋' }).click();
  await page.waitForSelector('.gd-table-screen');
  await page.getByRole('button', { name: '更多' }).click();
  await page.waitForSelector('.ipad-info-sheet');
  const gdInfoOverflow = await countOverflow(page, [
    '.ipad-info-card strong',
    '.ipad-info-control-head strong',
    '.ipad-info-segmented .btn',
  ]);
  const gdInfoSummary = await page.locator('.ipad-info-sheet-title span').textContent();
  const gdInfoTextLeaks = await findLiteralLeaks(page, ['.gd-topbar', '.ipad-info-sheet']);
  const gdInfoActionVisible = await page.evaluate(() => {
    const sheet = document.querySelector('.ipad-info-sheet');
    const actionButton = document.querySelector('.ipad-info-actions .btn');
    if (!sheet || !actionButton) {
      return false;
    }
    const sheetRect = sheet.getBoundingClientRect();
    const actionRect = actionButton.getBoundingClientRect();
    return actionRect.height > 0 && actionRect.top >= sheetRect.top && actionRect.bottom <= sheetRect.bottom;
  });
  if (!gdInfoActionVisible) {
    errors.push('guandan-info-action-hidden');
  }
  await screenshot(page, 'guandan-info.png');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const gdOverflow = await countOverflow(page, [
    '.ddz-current-play-head',
    '.gd-seat-head strong',
    '.gd-seat-meta',
    '.gd-status-strip strong',
    '.gd-selection-strip strong',
  ]);
  const gdTextLeaks = await findLiteralLeaks(page, ['.gd-table-screen']);
  await screenshot(page, 'guandan.png');

  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));

  await dumpJson('summary.json', {
    menuState,
    menuCenter,
    appearancePillCount,
    appearanceExpandedBefore,
    appearanceExpandedAfter,
    holdemHud,
    infoCenter,
    settlementCenter,
    settlementButtons,
    holdemTextLeakCount: holdemTextLeaks.length,
    holdemTextLeaks,
    ddzOverflowCount: ddzOverflow.length,
    ddzOverflow,
    ddzTextLeakCount: ddzTextLeaks.length,
    ddzTextLeaks,
    gdInfoOverflowCount: gdInfoOverflow.length,
    gdInfoOverflow,
    gdInfoSummary,
    gdInfoActionVisible,
    gdInfoTextLeakCount: gdInfoTextLeaks.length,
    gdInfoTextLeaks,
    gdOverflowCount: gdOverflow.length,
    gdOverflow,
    gdTextLeakCount: gdTextLeaks.length,
    gdTextLeaks,
    finalState,
    errors,
  });

  await browser.close();
}

main().catch(async (error) => {
  await ensureDir(OUTPUT_DIR);
  await fs.writeFile(path.join(OUTPUT_DIR, 'error.txt'), `${error.stack ?? error}\n`, 'utf8');
  process.exitCode = 1;
});
