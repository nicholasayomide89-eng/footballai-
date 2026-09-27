// Génère favicon, icônes et images Open Graph avec Playwright (outil de développement uniquement).
// Usage : node build/images.mjs  (nécessite playwright installé globalement ou localement)
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = (p) => join(ROOT, "assets", p);
const font = (f) => "data:font/woff2;base64," + readFileSync(A("fonts/" + f)).toString("base64");
const faces = `@font-face{font-family:F;src:url(${font("fraunces.woff2")})}@font-face{font-family:F;font-style:italic;src:url(${font("fraunces-italic.woff2")})}@font-face{font-family:S;src:url(${font("sourcesans3.woff2")})}`;

writeFileSync(A("favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#7b2d32"/><text x="32" y="43" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" fill="#faf7f0">pf</text></svg>\n`);

const iconHtml = (size) => `<html><head><style>${faces}html,body{margin:0}div{width:${size}px;height:${size}px;background:#7b2d32;display:grid;place-items:center;color:#faf7f0;font:italic 400 ${size * 0.55}px/1 F;letter-spacing:-.02em}span{transform:translateY(-4%)}</style></head><body><div><span>pf</span></div></body></html>`;

const og = (l) => {
  const fr = l === "fr";
  return `<html><head><style>${faces}
  html,body{margin:0}
  .c{width:1200px;height:630px;background:#faf7f0;color:#1e1c19;box-sizing:border-box;padding:80px 90px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
  .e{font:600 20px S;letter-spacing:.18em;text-transform:uppercase;color:#7b2d32;display:flex;align-items:center;gap:18px}
  .e:before{content:"";width:48px;height:1.5px;background:#7b2d32}
  h1{font:400 76px/1.04 F;margin:0;letter-spacing:-.015em}
  h1 em{color:#7b2d32}
  .f{display:flex;justify-content:space-between;align-items:flex-end;border-top:1.5px solid #d8d0bf;padding-top:26px;font:400 26px S;color:#45413b}
  .n{font:400 34px F;color:#1e1c19}
  .m{position:absolute;right:-30px;top:-70px;font:italic 400 420px/1 F;color:#f2e6e2}
  </style></head><body><div class="c"><div class="m">¶</div>
  <div class="e" style="position:relative">${fr ? "Révision · Rédaction · Traduction" : "Editing · Writing · Translation"}</div>
  <h1 style="position:relative">${fr ? "Des textes plus clairs.<br>Plus précis.<br>Plus <em>percutants.</em>" : "Clearer writing.<br>More precise.<br>More <em>compelling.</em>"}</h1>
  <div class="f" style="position:relative"><span class="n">Patrick Foley</span><span>Montréal, Québec</span></div></div></body></html>`;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [name, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["favicon-32.png", 32]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconHtml(size));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: A(name) });
}
for (const l of ["fr", "en"]) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og(l));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: A(l === "fr" ? "og-image.png" : "og-image-en.png") });
}
await browser.close();

// favicon.ico : conteneur ICO enveloppant le PNG 32×32
const png = readFileSync(A("favicon-32.png"));
const h = Buffer.alloc(22);
h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
h.writeUInt8(32, 6); h.writeUInt8(32, 7); h.writeUInt8(0, 8); h.writeUInt8(0, 9);
h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
writeFileSync(join(ROOT, "favicon.ico"), Buffer.concat([h, png]));
console.log("Images générées.");
