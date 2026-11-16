/** GitHub Actions only: integration smoke against the compiled MV3 extension.
 *  No user installation prerequisites. Records browser and worker errors.
 *  The baseline must render at least one arrow on its side-panel board.
 */
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const ext = resolve('apps/extension/.output/chrome-mv3');
const profile = mkdtempSync(join(tmpdir(), 'cmv2-brave-smoke-'));
const messages = [];
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker', { timeout: 30000 });
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  page.on('pageerror', err => messages.push('PAGE ERROR ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') messages.push('CONSOLE ' + msg.text());
  });
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await page.locator('[data-testid="board"]').waitFor({ timeout: 30000 });
  const analyze = page.locator('[data-testid="analyze"]');
  if ((await analyze.innerText()).trim() === 'Analyze') await analyze.click();

  // Keep the test independent of exact shapes/CSS; Chessground renders paths.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="board"] svg path').length > 0,
    { timeout: 110000 },
  );
  const count = await page.locator('[data-testid="board"] svg path').count();
  const status = await page.locator('[data-testid="arrow-status"]').allTextContents();
  const maiaError = await page.locator('.ribbon').allTextContents();
  console.log('SMOKE: rendered SVG paths:', count);
  console.log('SMOKE: status:', JSON.stringify(status));
  console.log('SMOKE: ribbons:', JSON.stringify(maiaError));
  if (count === 0) throw new Error('Chessground did not display a single arrow');
} catch (err) {
  console.error('SMOKE FAILED:', err);
  console.error(messages.slice(-20).join('\n'));
  throw err;
} finally {
  await context?.close();
  rmSync(profile, { recursive: true, force: true });
}
