// Page weight in a real browser: every byte the page fetches after a full scroll (lazy images included).
// Usage: node scripts/weight.mjs <slug> [route] [--dir dist/<slug>]  → prints JSON for phone 390 and desktop 1280
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
import { launch } from './browser.mjs';

const a = process.argv.slice(2);
const slug = a[0];
const route = a[1] && !a[1].startsWith('--') ? a[1] : '/';
const i = a.indexOf('--dir');
const dir = path.resolve(i >= 0 ? a[i + 1] : `dist/${slug}`);
const { server, url } = await serve(dir);
const browser = await launch();
const out = { slug, route };
for (const vp of [{ n: 'phone390', width: 390, height: 844 }, { n: 'desktop1280', width: 1280, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const by = { html: 0, css: 0, js: 0, font: 0, img: 0, other: 0 };
  page.on('response', async (r) => {
    try {
      const b = (await r.body()).length;
      const t = r.request().resourceType();
      const k = t === 'document' ? 'html' : t === 'stylesheet' ? 'css' : t === 'script' ? 'js' : t === 'font' ? 'font' : t === 'image' ? 'img' : 'other';
      by[k] += b;
    } catch {}
  });
  await page.goto(url + route, { waitUntil: 'load' });
  await page.evaluate(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.7)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
  const total = Object.values(by).reduce((s, x) => s + x, 0);
  out[vp.n] = { totalKB: Math.round(total / 1024), ...Object.fromEntries(Object.entries(by).map(([k, v]) => [k + 'KB', +(v / 1024).toFixed(1)])) };
  await ctx.close();
}
await browser.close(); server.close();
console.log(JSON.stringify(out));
if (a.includes('--save')) { fs.mkdirSync('reports', { recursive: true }); fs.writeFileSync(`reports/weight-${slug}.json`, JSON.stringify(out, null, 2)); }
