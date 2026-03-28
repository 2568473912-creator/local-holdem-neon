import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/Users/klaywei/Documents/local-holdem-neon/output/ipad-hand-shop';
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4173/';

const contextOptions = {
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
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

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];

  const wait = (ms) => page.waitForTimeout(ms);
  const readState = () =>
    page.evaluate(() => {
      if (typeof window.render_game_to_text !== 'function') return null;
      return JSON.parse(window.render_game_to_text());
    });

  const advance = async (ms) => {
    await page.evaluate((delay) => window.advanceTime?.(delay), ms);
    await wait(180);
  };

  const advanceUntil = async (matcher, options = {}) => {
    const { steps = 16, ms = 1600 } = options;
    for (let step = 0; step < steps; step += 1) {
      const current = await readState();
      if (matcher(current)) {
        return current;
      }
      await advance(ms);
    }
    return readState();
  };

  const openHome = async () => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await wait(320);
  };

  const dragAcrossCards = async (rowSelector, startIndex, endIndex) => {
    const cards = page.locator(`${rowSelector} .ddz-card`);
    const startBox = await cards.nth(startIndex).boundingBox();
    const endBox = await cards.nth(endIndex).boundingBox();
    if (!startBox || !endBox) {
      throw new Error(`Unable to resolve cards for ${rowSelector}`);
    }

    const startX = startBox.x + startBox.width / 2;
    const startY = startBox.y + startBox.height * 0.72;
    const endX = endBox.x + endBox.width / 2;
    const endY = endBox.y + endBox.height * 0.72;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: Math.max(6, Math.abs(endIndex - startIndex) * 4) });
    await page.mouse.up();
    await wait(220);
  };

  const readHandSelection = async (rowSelector) =>
    page.evaluate((selector) => {
      const row = document.querySelector(selector);
      const cards = [...document.querySelectorAll(`${selector} .ddz-card[data-card-id]`)];
      return {
        rowClassName: row?.className ?? '',
        selectedCount: cards.filter((node) => node.classList.contains('selected')).length,
        selectedIds: cards.filter((node) => node.classList.contains('selected')).map((node) => node.getAttribute('data-card-id')),
      };
    }, rowSelector);

  const readStripState = async (stripSelector, activeSelector) =>
    page.evaluate(({ stripSelector: selector, activeSelector: active }) => {
      const strip = document.querySelector(selector);
      const activeNode = strip?.querySelector(active) ?? null;
      if (!strip) {
        return null;
      }

      const stripRect = strip.getBoundingClientRect();
      const activeRect = activeNode?.getBoundingClientRect() ?? null;
      return {
        scrollLeft: Number(strip.scrollLeft.toFixed(2)),
        clientWidth: strip.clientWidth,
        scrollWidth: strip.scrollWidth,
        scrollable: strip.scrollWidth > strip.clientWidth + 4,
        canScrollLeft: strip.classList.contains('can-scroll-left'),
        canScrollRight: strip.classList.contains('can-scroll-right'),
        activeVisible: activeRect ? activeRect.left >= stripRect.left - 4 && activeRect.right <= stripRect.right + 4 : false,
        activeCenterDelta: activeRect ? Number(Math.abs(activeRect.left + activeRect.width / 2 - (stripRect.left + stripRect.width / 2)).toFixed(2)) : null,
      };
    }, { stripSelector, activeSelector });

  try {
    await openHome();
    await page.locator('.game-hub-store-hitbox').click();
    await page.getByRole('dialog', { name: '积分商店' }).waitFor();
    await wait(240);

    const shopTabsBefore = await readStripState('.menu-shop-tabs', '[data-shop-tab="portrait"]');
    const shopFilterBefore = await readStripState('.menu-shop-filter-group', '[data-shop-filter="all"]');
    await page.getByRole('button', { name: 'AI 形象包' }).click();
    await wait(280);
    const shopTabsAfter = await readStripState('.menu-shop-tabs', '[data-shop-tab="ai-pack"]');
    await page.getByRole('button', { name: '待解锁' }).click();
    await wait(260);
    const shopFilterAfter = await readStripState('.menu-shop-filter-group', '[data-shop-filter="locked"]');
    await screenshot(page, 'shop-scroll.png');

    if (shopTabsBefore?.scrollable && !shopTabsBefore.canScrollRight) {
      errors.push('Shop tabs should show a right scroll hint before moving to the last tab.');
    }
    if (!shopTabsAfter?.activeVisible) {
      errors.push('Shop tabs should keep the active tab visible after switching to AI pack.');
    }
    if (shopTabsBefore?.scrollable && (shopTabsAfter?.scrollLeft ?? 0) <= (shopTabsBefore.scrollLeft ?? 0) + 4) {
      errors.push('Shop tabs should scroll when the active tab moves to the far end.');
    }
    if (shopTabsAfter?.scrollable && !shopTabsAfter.canScrollLeft) {
      errors.push('Shop tabs should show a left scroll hint after moving away from the first tab.');
    }
    if (!shopFilterAfter?.activeVisible) {
      errors.push('Shop filters should keep the active filter visible after switching.');
    }

    await openHome();
    await page.getByRole('button', { name: '进入抢地主·夜场' }).click();
    await page.getByRole('button', { name: '开始斗地主' }).click();
    await wait(900);

    const ddzState = await readState();
    if (ddzState?.doudizhu?.phase === 'bidding' && ddzState.doudizhu.currentPlayerId === 'P0') {
      await page.getByRole('button', { name: /叫 1 分|叫1分|Bid 1/ }).first().click();
      await wait(260);
    }

    await advanceUntil((current) => current?.screen === 'doudizhu' && current?.doudizhu?.phase === 'playing' && current?.doudizhu?.currentPlayerId === 'P0');
    await dragAcrossCards('.ddz-hand-row', 0, 4);
    const ddzSelection = await readHandSelection('.ddz-hand-row');
    await screenshot(page, 'doudizhu-sweep.png');

    if (!ddzSelection.rowClassName.includes('sweep-enabled')) {
      errors.push('Dou Dizhu hand row should enable sweep mode on iPad hero turns.');
    }
    if (ddzSelection.selectedCount < 3) {
      errors.push(`Dou Dizhu sweep should select multiple cards, got ${ddzSelection.selectedCount}.`);
    }

    await openHome();
    await page.getByRole('button', { name: '进入升级场·掼蛋' }).click();
    await page.getByRole('button', { name: '开始掼蛋' }).click();
    await advanceUntil((current) => current?.screen === 'guandan' && current?.guandan?.phase === 'playing' && current?.guandan?.currentPlayerId === 'P0');
    await dragAcrossCards('.gd-hand-row', 0, 4);
    const gdSelection = await readHandSelection('.gd-hand-row');
    await screenshot(page, 'guandan-sweep.png');

    if (!gdSelection.rowClassName.includes('sweep-enabled')) {
      errors.push('Guandan hand row should enable sweep mode on iPad hero turns.');
    }
    if (gdSelection.selectedCount < 3) {
      errors.push(`Guandan sweep should select multiple cards, got ${gdSelection.selectedCount}.`);
    }

    await dumpJson('summary.json', {
      shop: {
        tabsBefore: shopTabsBefore,
        tabsAfter: shopTabsAfter,
        filterBefore: shopFilterBefore,
        filterAfter: shopFilterAfter,
      },
      doudizhu: ddzSelection,
      guandan: gdSelection,
      errors,
    });
  } finally {
    await context.close();
    await browser.close();
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

await main();
