import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../output/v3-skin-preview');

const SKINS = [
  'ember-strike',
  'lotus-dream',
  'void-sigil',
  'neon-comet',
  'gilded-burst',
  'prism-pulse',
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`Output dir ready: ${outputDir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1376, height: 900 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  // Set localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem(
      'neon.holdem.motion-preferences.v1',
      JSON.stringify({ level: 'full' })
    );
  });

  console.log('Navigating to http://127.0.0.1:4175 ...');
  await page.goto('http://localhost:4175', { waitUntil: 'domcontentloaded' });

  // Navigate through hub if present, then start/resume a Hold'em game
  console.log('Looking for entry button...');

  // Check if we're on the hub page
  const hubBtn = await page.locator('text=进入冠军桌·德州').first();
  const hubBtnVisible = await hubBtn.isVisible().catch(() => false);
  if (hubBtnVisible) {
    console.log('Clicking "进入冠军桌·德州" (hub entry)...');
    await hubBtn.click();
    await page.waitForTimeout(1000);
  }

  // Now look for resume or start buttons
  const resumeBtn = await page.locator('text=继续德州对局').first();
  const resumeVisible = await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (resumeVisible) {
    console.log('Clicking "继续德州对局"...');
    await resumeBtn.click();
  } else {
    const startBtn = await page.locator('text=开始游戏').first();
    const startVisible = await startBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (startVisible) {
      console.log('Clicking "开始游戏"...');
      await startBtn.click();
    } else {
      // Dump current page buttons for debugging
      const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent));
      console.log('Available buttons:', btns);
      throw new Error('Could not find start or resume button');
    }
  }

  // Wait for .table-scene to appear
  console.log('Waiting for .table-scene...');
  await page.waitForSelector('.table-scene', { timeout: 20000 });
  console.log('.table-scene found.');

  for (const skinKey of SKINS) {
    console.log(`Applying skin: ${skinKey}`);

    await page.evaluate((key) => {
      const layer = document.querySelector('.table-effects-layer');
      if (!layer) throw new Error('.table-effects-layer not found');

      // Remove all fx-style-* classes
      const toRemove = [...layer.classList].filter((c) => c.startsWith('fx-style-'));
      toRemove.forEach((c) => layer.classList.remove(c));

      // Add the new skin class
      layer.classList.add(`fx-style-${key}`);
    }, skinKey);

    // Wait 800ms for animations to settle
    await page.waitForTimeout(800);

    const screenshotPath = path.join(outputDir, `${skinKey}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Saved: ${screenshotPath}`);
  }

  await browser.close();
  console.log('Done. Browser closed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
