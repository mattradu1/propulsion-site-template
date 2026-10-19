// axe-core (WCAG 2.0/2.1/2.2 A+AA) on every page of the live and preview builds.
// Usage: node scripts/axe.mjs <slug>  → reports/axe-<slug>.json
// Same engine as `npx @axe-core/cli`; run through Playwright because @axe-core/cli needs a chromedriver download.
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
import { launch, routesOf } from './browser.mjs';

const slug = process.argv[2] || 'test-roofing';
const axePath = path.resolve('node_modules/axe-core/axe.min.js');
const browser = await launch();
const out = {};
let serious = 0;
for (const build of [slug, `${slug}--preview`]) {
  const dir = path.resolve('dist', build);
  if (!fs.existsSync(dir)) continue;
  const { server, url } = await serve(dir);
  out[build] = {};
  for (const vp of [{ n: 'phone', width: 390, height: 844 }, { n: 'desktop', width: 1280, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true });
    for (const r of [...routesOf(dir), '/404.html']) {
      const page = await ctx.newPage();
      await page.goto(url + r);
      await page.addScriptTag({ path: axePath });
      const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
      const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of res.violations) counts[v.impact] = (counts[v.impact] || 0) + v.nodes.length;
      serious += counts.critical + counts.serious;
      out[build][`${vp.n} ${r}`] = { counts, violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), passes: res.passes.length };
      await page.close();
    }
    await ctx.close();
  }
  server.close();
}
await browser.close();
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(`reports/axe-${slug}.json`, JSON.stringify({ axeVersion: JSON.parse(fs.readFileSync('node_modules/axe-core/package.json', 'utf8')).version, results: out }, null, 2));
for (const [b, pages] of Object.entries(out)) for (const [p, r] of Object.entries(pages))
  console.log(`${b.padEnd(22)} ${p.padEnd(22)} critical ${r.counts.critical} · serious ${r.counts.serious} · moderate ${r.counts.moderate} · minor ${r.counts.minor}${r.violations.length ? '  ← ' + r.violations.map((v) => v.id).join(', ') : ''}`);
console.log(serious ? `axe: ${serious} serious/critical nodes` : 'axe: 0 serious or critical issues on every page');
process.exit(serious ? 1 : 0);
