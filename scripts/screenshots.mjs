// Screenshot driver: runs scripted steps in the locally installed Chrome (playwright-core, no browser
// download). Usage:
//   node scripts/screenshots.mjs <steps.json> <outDir>
// steps.json: [{ "viewport": [1280, 800], "mobile": false, "reduced": false }, { "goto": "/" },
//   { "wait": 1500 }, { "hover": [x, y] }, { "click": [x, y] }, { "clickSel": ".region-label" },
//   { "focusSel": "..." }, { "key": "Escape" }, { "eval": "js" }, { "shot": "name" }]
// Env: BASE (default http://localhost:4400).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [stepsFile, outDir] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:4400';
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
});

const logs = [];
let context;
let page;

async function newPage(opts) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width: opts.viewport?.[0] ?? 1280, height: opts.viewport?.[1] ?? 800 },
    deviceScaleFactor: opts.dpr ?? 1,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
}

for (const step of steps) {
  if (step.viewport) await newPage(step);
  else if (step.goto) await page.goto(base + step.goto, { waitUntil: 'load' });
  else if (step.wait) await page.waitForTimeout(step.wait);
  else if (step.hover) await page.mouse.move(step.hover[0], step.hover[1], { steps: 4 });
  else if (step.click) await page.mouse.click(step.click[0], step.click[1]);
  else if (step.tap) await page.touchscreen.tap(step.tap[0], step.tap[1]);
  else if (step.clickSel) await page.locator(step.clickSel).first().click();
  else if (step.hoverSel) await page.locator(step.hoverSel).first().hover();
  else if (step.focusSel) await page.locator(step.focusSel).first().focus();
  else if (step.key) await page.keyboard.press(step.key);
  else if (step.eval) logs.push(`eval: ${JSON.stringify(await page.evaluate(step.eval))}`);
  else if (step.shot) await page.screenshot({ path: path.join(outDir, `${step.shot}.png`) });
}

await browser.close();
console.log(logs.length ? logs.join('\n') : 'no console errors');
