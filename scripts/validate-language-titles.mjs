import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
await page.goto('http://127.0.0.1:4186', { waitUntil: 'networkidle' });
const getTexts = async () => ({
  h1s: await page.locator('h1').allInnerTexts(),
  subtitles: await page.locator('.subtitle').allInnerTexts(),
  menuGame: JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).menu?.page,
});
await page.selectOption('.legal-entry-dock select', 'en');
await page.click('.game-hub-mode-card-holdem .btn');
await page.waitForTimeout(250);
const holdem = await getTexts();
await page.click('.submenu-head .btn');
await page.waitForTimeout(200);
await page.selectOption('.legal-entry-dock select', 'ja');
await page.click('.game-hub-mode-card-doudizhu .btn');
await page.waitForTimeout(250);
const ddz = await getTexts();
await page.click('.ddz-menu-switch .btn');
await page.waitForTimeout(200);
await page.selectOption('.legal-entry-dock select', 'de');
await page.click('.game-hub-mode-card-guandan .btn');
await page.waitForTimeout(250);
const gd = await getTexts();
console.log(JSON.stringify({holdem, ddz, gd}, null, 2));
await browser.close();
