import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.OUTPUT_DIR ? path.resolve(process.env.OUTPUT_DIR) : path.resolve('output/app-store-ipad-13');
const viewport = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1376),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 1032),
};
const contextOptions = {
  viewport,
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
};

async function waitForScreen(page, expected) {
  await page.waitForFunction(
    (screen) => {
      if (typeof window.render_game_to_text !== 'function') return false;
      try {
        const payload = JSON.parse(window.render_game_to_text());
        return payload.screen === screen;
      } catch {
        return false;
      }
    },
    expected,
    { timeout: 15000 },
  );
}

async function waitForVisible(page, selector) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 });
}

async function readState(page) {
  return await page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') return null;
    return JSON.parse(window.render_game_to_text());
  });
}

async function settle(page, ms = 1200) {
  await page.evaluate((delay) => window.advanceTime?.(delay), ms);
  await page.waitForTimeout(150);
}

async function capture(browser, name, runner) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query === '(display-mode: standalone)') {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        };
      }
      return originalMatchMedia(query);
    };
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      get: () => true,
    });
  });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await runner(page);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
  const state = await readState(page);
  await context.close();
  return { name, state };
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const summary = [];

try {
  summary.push(
    await capture(browser, '01-menu-hub.png', async (page) => {
      await page.getByRole('heading', { name: '夜局' }).waitFor();
      await settle(page, 600);
    }),
  );

  summary.push(
    await capture(browser, '02-holdem-menu.png', async (page) => {
      await page.getByRole('button', { name: '进入冠军桌·德州' }).click();
      await page.getByRole('heading', { name: '冠军桌·德州' }).waitFor();
      await settle(page, 600);
    }),
  );

  summary.push(
    await capture(browser, '03-holdem-table.png', async (page) => {
      await page.getByRole('button', { name: '进入冠军桌·德州' }).click();
      await page.getByRole('heading', { name: '冠军桌·德州' }).waitFor();
      await page.getByRole('button', { name: '开始游戏' }).click();
      await waitForScreen(page, 'table');
      await waitForVisible(page, '.table-scene');
      await settle(page, 1800);
    }),
  );

  summary.push(
    await capture(browser, '04-holdem-focus-controls.png', async (page) => {
      await page.getByRole('button', { name: '进入冠军桌·德州' }).click();
      await page.getByRole('heading', { name: '冠军桌·德州' }).waitFor();
      await page.getByRole('button', { name: '开始游戏' }).click();
      await waitForScreen(page, 'table');
      await waitForVisible(page, '.table-scene');
      await settle(page, 1600);
      const focusButton = page.getByRole('button', { name: /专注牌桌|退出专注/ }).first();
      if (await focusButton.isVisible()) {
        await focusButton.click();
        await page.waitForTimeout(250);
      }
      const controlsButton = page.getByRole('button', { name: '操作面板' }).first();
      if (await controlsButton.isVisible()) {
        await controlsButton.click();
        await page.waitForTimeout(250);
      }
      await settle(page, 1200);
    }),
  );

  summary.push(
    await capture(browser, '05-doudizhu-table.png', async (page) => {
      await page.getByRole('button', { name: '进入抢地主·夜场' }).click();
      await page.getByRole('heading', { name: '抢地主·夜场' }).waitFor();
      await page.getByRole('button', { name: '开始斗地主' }).click();
      await waitForScreen(page, 'doudizhu');
      await waitForVisible(page, '.ddz-table-screen');
      await settle(page, 900);
    }),
  );

  summary.push(
    await capture(browser, '06-guandan-table.png', async (page) => {
      await page.getByRole('button', { name: '进入升级场·掼蛋' }).click();
      await page.getByRole('heading', { name: '升级场·掼蛋' }).waitFor();
      await page.getByRole('button', { name: '开始掼蛋' }).click();
      await waitForScreen(page, 'guandan');
      await waitForVisible(page, '.gd-table-screen');
      await settle(page, 900);
    }),
  );

  summary.push(
    await capture(browser, '07-guandan-progress.png', async (page) => {
      await page.getByRole('button', { name: '进入升级场·掼蛋' }).click();
      await page.getByRole('heading', { name: '升级场·掼蛋' }).waitFor();
      await page.getByRole('button', { name: '开始掼蛋' }).click();
      await waitForScreen(page, 'guandan');
      await waitForVisible(page, '.gd-table-screen');
      await settle(page, 3200);
    }),
  );
} finally {
  await browser.close();
}

await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify({ appUrl, viewport, captures: summary }, null, 2));
console.log(`Captured ${summary.length} iPad App Store screenshots to ${outputDir}`);
