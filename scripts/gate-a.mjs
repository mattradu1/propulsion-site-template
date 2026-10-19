// Runs qa/qa-gate-a.js headless on every page of the local PREVIEW build, phone width first.
// Usage: node scripts/gate-a.mjs <slug>   → reports/gate-a-<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
import { launch, routesOf } from './browser.mjs';

const slug = process.argv[2] || 'test-roofing';
const dir = path.resolve('dist', `${slug}--preview`);
if (!fs.existsSync(dir)) { console.error(`No preview build at ${dir}. Run: node build.mjs ${slug} --preview`); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(`clients/${slug}/client.json`, 'utf8'));
const routes = [...routesOf(dir), '/404.html'];
const pend = (v) => v && typeof v === 'object' && typeof v.pending === 'string';
const QA_CFG = { phonePending: pend(cfg.phone), ctaLabel: typeof cfg.copy?.ctaLabel === 'string' ? cfg.copy.ctaLabel : null, internalReference: cfg.internalReference === true, phone: pend(cfg.phone) ? null : cfg.phone, gbpPhone: pend(cfg.gbpPhone) ? null : cfg.gbpPhone, routes, reviewTexts: (cfg.reviews || []).map((r) => r.text), preview: true, testFormAction: cfg.preview.testFormAction, demo: !!cfg.demo, domain: cfg.domain };
const script = fs.readFileSync('qa/qa-gate-a.js', 'utf8');
const axePath = path.resolve('node_modules/axe-core/axe.min.js');
const { server, url } = await serve(dir);
const browser = await launch();
const pages = [];
for (const vp of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }]) {
  // bypassCSP lets the runner inject axe; the page's own CSP is still verified by the script.
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true });
  for (const r of routes) {
    const page = await ctx.newPage();
    await page.goto(url + r, { waitUntil: 'load' });
    const tag = await page.addScriptTag({ path: axePath });
    await tag.evaluate((e) => e.setAttribute('data-qa-runner', ''));
    await page.evaluate((c) => { window.QA_CFG = c; }, QA_CFG);
    const res = await page.evaluate(script);
    // Lighthouse replaces PageSpeed Insights here (PSI API is blocked); see reports/lighthouse-*.json.
    pages.push({ viewport: vp.name, route: r, ...res });
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();
const all = pages.flatMap((p) => p.results.map((x) => ({ ...x, route: p.route, viewport: p.viewport })));
const count = (k) => all.filter((x) => x.result === k).length;
const summary = { slug, ranAt: new Date().toISOString(), pages: pages.length, pass: count('PASS'), fail: count('FAIL'), amber: count('AMBER'), needsTesting: count('NEEDS TESTING'),
  failures: all.filter((x) => x.result === 'FAIL'), ambers: [...new Set(all.filter((x) => x.result === 'AMBER').map((x) => `${x.check}: ${x.detail}`))],
  needsTestingItems: [...new Set(all.filter((x) => x.result === 'NEEDS TESTING').map((x) => `${x.check}: ${x.detail}`))] };
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(`reports/gate-a-${slug}.json`, JSON.stringify({ summary, pages }, null, 2));
console.log(`Gate A ${slug}: ${summary.pages} page-runs · ${summary.pass} pass · ${summary.fail} FAIL · ${summary.amber} amber · ${summary.needsTesting} needs testing`);
for (const f of summary.failures) console.log(`  FAIL ${f.viewport} ${f.route} — ${f.check}: ${f.detail}`);
for (const a of summary.ambers) console.log(`  AMBER ${a}`);
process.exit(summary.fail ? 1 : 0);
