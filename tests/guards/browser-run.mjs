// Deliberate-failure tests for the real-browser checks (scripts/browser-checks.mjs).
// Builds Test Bathrooms, breaks one thing in the output, and proves the browser check catches it.
// Run: npm run test:browser   → reports/browser-guard-tests.json
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../../build.mjs';
import { runChecks } from '../../scripts/browser-checks.mjs';
import { launch } from '../../scripts/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TMP = path.join(ROOT, '.tmp', 'browser-guards');
fs.rmSync(TMP, { recursive: true, force: true });
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'clients/test-bathrooms/client.json'), 'utf8'));
const VPS = [{ n: 'phone-390', width: 390, height: 844 }, { n: 'tablet-768', width: 768, height: 1024 }];
const browser = await launch();

async function fresh(id) {
  const outDir = path.join(TMP, id);
  const r = await build({ slug: 'test-bathrooms', outDir, root: ROOT });
  if (!r.ok) throw new Error('base build failed');
  return outDir;
}
const css = (d, rule) => fs.appendFileSync(path.join(d, 'assets/site.css'), rule);

const CASES = [
  ['BC1', 'Tap targets', 'Footer links shrunk below 44px at tablet width (the lesson from Darren\'s site)', (d) => css(d, '.f-cols a{min-width:0;min-height:20px}')],
  ['BC2', 'No sideways scroll', 'A fixed-width element wider than a 390px phone', (d) => css(d, '.trust-band .wrap{min-width:640px}')],
  ['BC3', 'Computed fonts', 'Self-hosted text font removed, so the browser falls back', (d) => { const f = path.join(d, 'assets/site.css'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/@font-face\{font-family:"Montserrat"[^}]*\}/g, '')); }],
  ['BC4', 'Six font sizes', 'A seventh size in use', (d) => css(d, '.eyebrow{font-size:13px!important}')],
  ['BC5', 'Every image loads', 'A lazy-loaded project image missing from the build', (d) => { const dir = path.join(d, 'assets/img'); for (const f of fs.readdirSync(dir).filter((x) => /^p2-day-project/.test(x))) fs.rmSync(path.join(dir, f)); }],
  ['BC6', 'Phone menu', 'Menu script broken', (d) => fs.writeFileSync(path.join(d, 'assets/site.js'), '/* broken */')],
  ['BC7', 'Copy phrase visible', 'Approved line hidden with CSS', (d) => css(d, '.hero-copy .tagline{display:none}')],
  // v3
  ['BC8', 'Reduced motion', 'Hero words left mid-animation for visitors who asked for less motion', (d) => css(d, '.hero h1 .w{transform:translateY(8px)!important}')],
  ['BC9', 'No JavaScript', 'Before/after fallback stacks the photos instead of side by side', (d) => css(d, '.ba{grid-template-columns:1fr}')],
  ['BC10', 'Before/after touch', 'Slider ignores pointer and touch (drag handler removed)', (d) => { const f = path.join(d, 'assets/site.js'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("box.addEventListener('pointerdown'", "box.addEventListener('pointerdown-disabled'")); }],
];
const rows = [];
for (const [id, check, desc, fn] of CASES) {
  const d = await fresh(id);
  fn(d);
  const res = await runChecks(d, cfg, { browser, viewports: VPS });
  const hit = res.find((r) => r.result === 'FAIL' && r.check.startsWith(check.split(' ')[0]) && r.check.includes(check.split(' ').slice(-1)[0]));
  rows.push({ id, check, test: desc, result: hit ? 'PASS' : 'FAIL', message: hit ? `${hit.viewport} ${hit.route}: ${hit.detail}` : `not caught (${res.filter((r) => r.result === 'FAIL').map((r) => r.check).join(', ') || 'all passed'})` });
}
const ctl = await fresh('OK');
const okRes = await runChecks(ctl, cfg, { browser, viewports: VPS });
rows.push({ id: 'OK', check: 'Control', test: 'Untouched build passes every browser check', result: okRes.every((r) => r.result === 'PASS') ? 'PASS' : 'FAIL', message: okRes.filter((r) => r.result === 'FAIL').map((r) => `${r.check}: ${r.detail}`).join(' | ') || `${okRes.length} checks ok` });
await browser.close();
for (const r of rows) console.log(`${r.result.padEnd(4)} ${r.id.padEnd(4)} ${r.check.padEnd(20)} ${r.test}\n          → ${r.message.slice(0, 200)}`);
console.log(`\nBrowser deliberate-failure tests: ${rows.filter((r) => r.id !== 'OK' && r.result === 'PASS').length}/${rows.length - 1} pass · control ${rows.at(-1).result}`);
fs.writeFileSync(path.join(ROOT, 'reports/browser-guard-tests.json'), JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(rows.some((r) => r.result !== 'PASS') ? 1 : 0);
