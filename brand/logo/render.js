// Usage: node render.js <svgDir> <pngDir> <previewPng>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [svgDir, pngDir, previewPath] = process.argv.slice(2);
fs.mkdirSync(pngDir, { recursive: true });

const read = (n) => fs.readFileSync(path.join(svgDir, n), 'utf8');

// [svg, png name, width, height]
const jobs = [
  ['blackline-logo-black.svg', 'blackline-logo-black.png', 2400],
  ['blackline-logo-white.svg', 'blackline-logo-white.png', 2400],
  ['blackline-logo-mono-black.svg', 'blackline-logo-mono-black.png', 2400],
  ['blackline-logo-mono-white.svg', 'blackline-logo-mono-white.png', 2400],
  ['blackline-compact-black.svg', 'blackline-compact-black.png', 1600],
  ['blackline-compact-white.svg', 'blackline-compact-white.png', 1600],
  ['blackline-icon-dark.svg', 'blackline-icon-dark-1024.png', 1024, 1024],
  ['blackline-icon-light.svg', 'blackline-icon-light-1024.png', 1024, 1024],
  ['blackline-icon-dark.svg', 'blackline-icon-dark-512.png', 512, 512],
  ['blackline-icon-dark.svg', 'icon-192.png', 192, 192],
  ['blackline-icon-dark.svg', 'apple-touch-icon.png', 180, 180],
  ['favicon.svg', 'favicon-32.png', 32, 32],
  ['favicon.svg', 'favicon-16.png', 16, 16],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [svg, png, w, hGiven] of jobs) {
    const src = read(svg);
    const vb = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const h = hGiven || Math.round((w * Number(vb[2])) / Number(vb[1]));
    await page.setViewportSize({ width: w, height: h });
    const sized = src.replace(/ width="[\d.]+" height="[\d.]+"/, ` width="${w}" height="${h}"`);
    await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
    await page.screenshot({ path: path.join(pngDir, png), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }

  if (previewPath) {
    const img = (n, style) => `<img src="data:image/svg+xml;base64,${Buffer.from(read(n)).toString('base64')}" style="${style}">`;
    const html = `<html><body style="margin:0;font-family:sans-serif">
      <div style="background:#F4F4F2;padding:60px;display:flex;flex-direction:column;gap:50px">
        ${img('blackline-logo-black.svg', 'width:1100px')}
        ${img('blackline-compact-black.svg', 'width:600px')}
        ${img('blackline-compact-black.svg', 'width:180px')}
      </div>
      <div style="background:#0B0B0C;padding:60px;display:flex;gap:40px;align-items:center">
        ${img('blackline-icon-light.svg', 'width:120px')}
        ${img('blackline-icon-dark.svg', 'width:120px;outline:1px solid #333;border-radius:26px')}
        ${img('favicon.svg', 'width:32px')}
        ${img('blackline-logo-white.svg', 'width:620px')}
      </div></body></html>`;
    await page.setViewportSize({ width: 1220, height: 700 });
    await page.setContent(html);
    await page.screenshot({ path: previewPath, fullPage: true });
  }
  await browser.close();
})();
