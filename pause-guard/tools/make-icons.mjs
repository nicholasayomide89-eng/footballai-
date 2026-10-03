// Renders extension/icons/icon.svg to the PNG sizes the manifest needs.
// Usage: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');
const svg = await readFile(path.join(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: path.join(dir, `icon-${size}.png`), omitBackground: true });
}
await browser.close();
console.log('Icons written to', dir);
