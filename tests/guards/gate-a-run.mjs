// Deliberate-failure tests for the v1.4 Gate A checks (qa/qa-gate-a.js), at 390px on a phone context.
// Builds a preview, breaks one thing, runs the real Gate A script, and proves the matching check FAILS.
// Run: npm run qa:gate-a-tests   → reports/gate-a-guard-tests.json
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../../build.mjs';
import { serve } from '../../scripts/serve.mjs';
import { launch } from '../../scripts/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TMP = path.join(ROOT, '.tmp', 'gate-a-guards');
fs.rmSync(TMP, { recursive: true, force: true });
const script = fs.readFileSync(path.join(ROOT, 'qa/qa-gate-a.js'), 'utf8');
const axePath = path.join(ROOT, 'node_modules/axe-core/axe.min.js');
const pend = (v) => v && typeof v === 'object' && typeof v.pending === 'string';
const browser = await launch();

async function run(id, slug, route, check, tamper) {
  const outDir = path.join(TMP, id);
  const r = await build({ slug, preview: true, outDir, root: ROOT });
  if (!r.ok) throw new Error(`${id}: base build failed`);
  if (tamper) tamper(outDir);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, `clients/${slug}/client.json`), 'utf8'));
  const QA_CFG = { phonePending: pend(cfg.phone), phone: pend(cfg.phone) ? null : cfg.phone, gbpPhone: pend(cfg.gbpPhone) ? null : cfg.gbpPhone, reviewTexts: (cfg.reviews || []).map((x) => x.text), preview: true, testFormAction: cfg.preview.testFormAction, demo: !!cfg.demo, internalReference: cfg.internalReference === true, domain: cfg.domain };
  const { server, url } = await serve(outDir);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(url + route, { waitUntil: 'load' });
  const tag = await page.addScriptTag({ path: axePath });
  await tag.evaluate((e) => e.setAttribute('data-qa-runner', ''));
  await page.evaluate((c) => { window.QA_CFG = c; }, QA_CFG);
  const res = await page.evaluate(script);
  await ctx.close(); server.close();
  const fails = res.results.filter((x) => x.result === 'FAIL');
  return check ? fails.find((x) => x.check.startsWith(check)) : fails;
}
const edit = (f, a, b) => { const s = fs.readFileSync(f, 'utf8'); if (!s.includes(a)) throw new Error('tamper did not apply: ' + a); fs.writeFileSync(f, s.replace(a, b)); };
const CASES = [
  ['GA1', 'darren-reference', '/', 'Sales demo mode never on a real client', 'Demo ribbon pasted into a real client page (darren-reference)', (d) => edit(path.join(d, 'index.html'), '<a class="skip" href="#main">Skip to content</a>', '<a class="skip" href="#main">Skip to content</a><div class="demo-ribbon" data-demo-ribbon><p><strong>DEMO — example site</strong></p></div>')],
  ['GA2', 'test-bathrooms', '/', 'Action bar never covers', 'Action bar no longer hides near the closing band and footer', (d) => edit(path.join(d, 'assets/site.js'), "'#enquire, .cta-band, .site-footer'", "'#no-such-zone'")],
  ['GA3', 'test-bathrooms', '/consultation/', 'Form fields 16px+', 'Form fields set at 14px (iOS zooms on focus)', (d) => fs.appendFileSync(path.join(d, 'assets/site.css'), '.enquiry input[type=text]{font-size:14px!important}')],
  ['GA4', 'test-roofing', '/', 'View transitions only without reduced motion', '@view-transition switched on for everyone', (d) => fs.appendFileSync(path.join(d, 'assets/site.css'), '@view-transition{navigation:auto}')],
  ['GA5', 'test-roofing', '/', 'Action bar: safe-area inset', 'Action bar padding loses the safe-area inset (home indicator overlap)', (d) => { const f = path.join(d, 'assets/site.css'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('calc(var(--s1) + env(safe-area-inset-bottom,0px))', 'var(--s1)')); }],
  ['GA6', 'test-roofing', '/', 'No scroll-driven animation on the hero', 'Scroll-driven animation put on the hero H1', (d) => fs.appendFileSync(path.join(d, 'assets/site.css'), '@keyframes zz{from{transform:none}}h1{animation:zz linear both;animation-timeline:view()}')],
];
const rows = [];
for (const [id, slug, route, check, desc, fn] of CASES) {
  let hit; try { hit = await run(id, slug, route, check, fn); } catch (e) { hit = null; console.error(e.message); }
  rows.push({ id, check, test: desc, result: hit ? 'PASS' : 'FAIL', message: hit ? hit.detail : 'not caught' });
}
for (const [slug, route] of [['test-bathrooms', '/'], ['test-bathrooms', '/consultation/'], ['test-roofing', '/']]) {
  const fails = await run('OK-' + slug + route.replace(/\//g, '-'), slug, route, null, null);
  rows.push({ id: 'OK', check: 'Control', test: `Untouched ${slug} ${route} at 390px: 0 FAIL`, result: fails.length ? 'FAIL' : 'PASS', message: fails.map((f) => `${f.check}: ${f.detail}`).join(' | ') || 'ok' });
}
await browser.close();
for (const r of rows) console.log(`${r.result.padEnd(4)} ${r.id.padEnd(4)} ${r.test}\n          → ${String(r.message).slice(0, 200)}`);
console.log(`\nGate A deliberate-failure tests: ${rows.filter((r) => r.id !== 'OK' && r.result === 'PASS').length}/${CASES.length} pass · controls ${rows.filter((r) => r.id === 'OK' && r.result === 'PASS').length}/3`);
fs.writeFileSync(path.join(ROOT, 'reports/gate-a-guard-tests.json'), JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(rows.some((r) => r.result !== 'PASS') ? 1 : 0);
