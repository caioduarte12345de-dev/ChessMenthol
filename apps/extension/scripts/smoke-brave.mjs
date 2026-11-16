/** GitHub Actions only: integration smoke against the compiled MV3 extension.
 *  No user installation prerequisites. Records browser and worker errors.
 *  The side-panel must render the Stockfish arrow AND four Maia-3 arrows.
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

  // Each of the five unique brush keys must render its own Chessground path.
  // Fail if Maia is unavailable even when Stockfish alone works.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="board"] svg path').length >= 5
       || document.body.textContent?.includes('Maia-3 indisponível:'),
    undefined,
    { timeout: 150000 },
  );
  const count = await page.locator('[data-testid="board"] svg path').count();
  const status = await page.locator('[data-testid="arrow-status"]').allTextContents();
  const maiaError = await page.locator('.ribbon').allTextContents();
  console.log('SMOKE: rendered SVG paths:', count);
  console.log('SMOKE: status:', JSON.stringify(status));
  console.log('SMOKE: ribbons:', JSON.stringify(maiaError));
  if (maiaError.some(x => x.includes('Maia-3 indisponível:'))) {
    throw new Error('Maia failed during browser inference: ' + maiaError.join(' | '));
  }
  if (count < 5) throw new Error('Expected five arrow paths, got ' + count);
} catch (err) {
  console.error('SMOKE FAILED:', err);
  console.error(messages.slice(-20).join('\n'));
  throw err;
} finally {
  await context?.close();
  rmSync(profile, { recursive: true, force: true });
}
