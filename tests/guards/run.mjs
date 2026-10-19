// Deliberate-failure tests: each case breaks one rule and proves the build FAILS
// with the right guard and a plain-English message. Positive controls prove good configs pass.
// Run: npm run test:guards   → prints a table, writes reports/guard-tests.json
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { build } from '../../build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TMP = path.join(ROOT, '.tmp', 'guards');
fs.rmSync(TMP, { recursive: true, force: true });
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'clients/test-roofing/client.json'), 'utf8'));
const fixtureOther = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/other-clients/other-roofer-marlow.json'), 'utf8'));

// Make a throwaway copy of the demo client, mutated by the case.
function client(id, mutate = () => {}) {
  const dir = path.join(TMP, id, 'client');
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(ROOT, 'clients/test-roofing/images'), path.join(dir, 'images'), { recursive: true });
  const cfg = structuredClone(base);
  (mutate || (() => {}))(cfg, dir);
  fs.writeFileSync(path.join(dir, 'client.json'), JSON.stringify(cfg, null, 2));
  return dir;
}
function others(id, list) {
  const dir = path.join(TMP, id, 'others');
  fs.mkdirSync(dir, { recursive: true });
  list.forEach((o, i) => fs.writeFileSync(path.join(dir, `o${i}.json`), JSON.stringify(o)));
  return dir;
}
const B = (id, mutate, opts = {}) => build({ clientDir: client(id, mutate), outDir: path.join(TMP, id, 'dist'), root: ROOT, ...opts });
// Build a good site, tamper with the output, then re-run only the output guards.
async function tamper(id, opts, fn) {
  const clientDir = client(id);
  const outDir = path.join(TMP, id, 'dist');
  const first = await build({ clientDir, outDir, root: ROOT, ...opts });
  if (!first.ok) return first;
  await fn(outDir);
  return build({ clientDir, outDir, root: ROOT, checkOnly: true, ...opts });
}
const edit = (f, a, b) => fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(a, b));

const CASES = [
  // [id, guard expected, description, run]
  ['G1a', 'G1 Placeholders', 'Bracket placeholder left in copy', () => B('G1a', (c) => { c.hero.intro = 'We cover [LOCATION] and nearby.'; })],
  ['G1b', 'G1 Placeholders', '"TO BE SUPPLIED" in a service', () => B('G1b', (c) => { c.services[0].description = 'TO BE SUPPLIED'; })],
  ['G1c', 'G1 Placeholders', '"TBC" in a project description', () => B('G1c', (c) => { c.projects[0].description = 'Details TBC'; })],
  ['G2', 'G2 Alt text', 'Project image with empty alt', () => B('G2', (c) => { c.projects[0].day.alt = ''; })],
  ['G3', 'G3 Contrast', 'Muted grey #9a9a9a on cream background', () => B('G3', (c) => { c.brand.colors.muted = '#9a9a9a'; })],
  ['G4', 'G4 Privacy', 'privacy.formHost empty', () => B('G4', (c) => { c.privacy.formHost = ''; })],
  ['G5a', 'G5 Funnel URL', 'funnelUrl is http://', () => B('G5a', (c) => { c.funnelUrl = 'http://funnel.example.com/test-roofing'; })],
  ['G5b', 'G5 Funnel URL', 'funnelUrl missing', () => B('G5b', (c) => { delete c.funnelUrl; })],
  ['G6', 'G6 Phone match', 'Site phone differs from GBP phone, no approval', () => B('G6', (c) => { c.gbpPhone = '01632 960999'; })],
  ['G7', 'G7 Image size', 'Hero is a noisy photo over the 200 KB cap', () => B('G7', null, {}), async (id) => {}],
  ['G8', 'G8 Image metadata', 'Metadata stripping disabled: GPS/camera tags reach /dist', () => build({ clientDir: client('G8'), outDir: path.join(TMP, 'G8', 'dist'), root: ROOT, keepMetadata: true })],
  ['G9a', 'G9 Third-party assets', 'Google Fonts CSS URL in brand config', () => B('G9a', (c) => { c.brand.fontCssUrl = 'https://fonts.googleapis.com/css2?family=Inter'; })],
  ['G9b', 'G9 Third-party assets', 'Tailwind Play CDN script injected into output', () => tamper('G9b', {}, (d) => edit(path.join(d, 'index.html'), '</head>', '<script src="https://cdn.tailwindcss.com"></script></head>'))],
  ['G10', 'G10 Review cuts', 'Review marked truncated without "…"', () => B('G10', (c) => { c.reviews[2].truncated = true; })],
  ['G11', 'G11 Owner photo', 'Owner photo set but not confirmed', () => B('G11', (c) => { c.owner.photoConfirmed = false; })],
  ['G12a', 'G12 Sitemap/robots domain', 'domain is a preview host (*.vercel.app)', () => B('G12a', (c) => { c.domain = 'https://test-roofing-git-main.vercel.app'; })],
  ['G12b', 'G12 Sitemap/robots domain', 'sitemap.xml tampered to a preview URL', () => tamper('G12b', {}, (d) => edit(path.join(d, 'sitemap.xml'), /https:\/\/www\.test-roofing\.example/g, 'https://preview.sitedrop.example'))],
  ['R1a', 'R1 Unsafe content', '<script> in client copy', () => B('R1a', (c) => { c.hero.intro = 'Hello <script>alert(1)</script>'; })],
  ['R1b', 'R1 Unsafe content', 'javascript: link in client copy', () => B('R1b', (c) => { c.services[1].description = 'javascript:alert(1)'; })],
  ['R1c', 'R1 Unsafe content', 'onclick handler + iframe injected into output', () => tamper('R1c', {}, (d) => edit(path.join(d, 'about/index.html'), '<main id="main">', '<main id="main"><div onclick="x()"></div><iframe src="https://evil.example"></iframe>'))],
  ['R2a', 'R2 Cross-client', "Another client's phone (slate-gutters) in copy", () => B('R2a', (c) => { c.process[0].text = 'Call 01632 960987 to start.'; })],
  ['R2b', 'R2 Cross-client', "Another client's email as this client's email", () => B('R2b', (c) => { c.email = 'jo@slate-gutters.example'; })],
  ['R2c', 'R2 Cross-client', "Another client's photo reused (file fingerprint)", () => B('R2c', (c, dir) => { fs.copyFileSync(path.join(ROOT, 'clients/slate-gutters/images/g1-day.jpg'), path.join(dir, 'images/p4-day.jpg')); })],
  ['R2d', 'R2 Cross-client', 'Phone from a --others fixtures folder in copy', () => B('R2d', (c) => { c.services[0].description = 'Ring 01632 960555.'; }, { othersDir: others('R2d', [{ ...fixtureOther, variant: 'C' }]) })],
  ['R3a', 'R3 Banned claims', '"best" in hero copy, not approved', () => B('R3a', (c) => { c.hero.intro = 'The best roofers in the Chilterns.'; })],
  ['R3b', 'R3 Banned claims', '"24/7" approved without a proof note', () => B('R3b', (c) => { c.services[0].description = '24/7 emergency call-outs.'; c.approvedClaims = [{ phrase: '24/7', proof: '' }]; })],
  ['R3c', 'R3 Banned claims', '"Free quotes" in a process step', () => B('R3c', (c) => { c.process[2].title = 'Free quotes'; })],
  ['R4', 'R4 PENDING marker', 'Strict (Gate B) build with ICO number still pending', () => B('R4', null, { strict: true })],
  ['R5a', 'R5 Preview mode', 'Preview build with no test inbox for the form', () => B('R5a', (c) => { delete c.preview; }, { preview: true })],
  ['R5b', 'R5 Preview mode', 'Preview banner removed from output', () => tamper('R5b', { preview: true }, (d) => edit(path.join(d, 'index.html'), /Preview – not live\./, 'Welcome.'))],
  ['R6', 'R6 Layout', 'Standard layout with only 5 photos', () => B('R6', (c) => { c.projects = c.projects.slice(0, 2); })],
  ['R7', 'R7 Variant', 'Same trade, same area, same variant as a fixture client', () => B('R7', null, { othersDir: others('R7', [fixtureOther]) })],
];
// G7 needs a real oversized image: replace the hero with gaussian noise.
CASES.find((c) => c[0] === 'G7')[3] = async () => {
  const dir = client('G7');
  await sharp({ create: { width: 2400, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 70 } } }).jpeg({ quality: 95 }).toFile(path.join(dir, 'images/hero.jpg'));
  return build({ clientDir: dir, outDir: path.join(TMP, 'G7', 'dist'), root: ROOT });
};

const CONTROLS = [
  ['OK1', 'Demo client, live build (pending ICO = amber only)', () => B('OK1')],
  ['OK2', 'Demo client, preview build', () => B('OK2', null, { preview: true })],
  ['OK3', 'Approved claim with proof note is allowed', () => B('OK3', (c) => { c.services[0].description = '24/7 emergency call-outs.'; c.approvedClaims = [{ phrase: '24/7', proof: 'Client written terms, Drive/Clients/DEMO/terms.pdf (DEMO)' }]; })],
  ['OK4', 'Phone mismatch with a written approval reason', () => B('OK4', (c) => { c.gbpPhone = '01632 960999'; c.phoneMismatchApproved = 'GBP being updated by client (DEMO)'; })],
  ['OK5', 'Client text with HTML is escaped, never rendered', null],
  ['OK6', 'Second client (slate-gutters, lowPhoto layout) builds', () => build({ slug: 'slate-gutters', outDir: path.join(TMP, 'OK6', 'dist'), root: ROOT })],
];
// OK5: "<b>" is not a dangerous tag; it must come out as text.
CONTROLS[4][2] = async () => {
  const r = await B('OK5', (c) => { c.services[0].description = 'Tiles & slates <b>bold</b>'; });
  const html = fs.readFileSync(path.join(TMP, 'OK5', 'dist', 'index.html'), 'utf8');
  if (!html.includes('Tiles &amp; slates &lt;b&gt;bold&lt;/b&gt;')) r.ok = false, r.problems.push({ level: 'fail', guard: 'Escape', msg: 'client HTML was not escaped' });
  return r;
};

const rows = [];
for (const [id, guard, desc, run] of CASES) {
  const r = await run();
  const hit = r.problems.find((p) => p.level === 'fail' && p.guard === guard);
  const pass = !r.ok && !!hit;
  rows.push({ id, guard, test: desc, expected: 'build fails', result: pass ? 'PASS' : 'FAIL', message: hit?.msg || `(no ${guard} failure; got: ${r.problems.filter((p) => p.level === 'fail').map((p) => p.guard + ': ' + p.msg).join(' | ') || 'build passed'})` });
}
for (const [id, desc, run] of CONTROLS) {
  const r = await run();
  rows.push({ id, guard: 'Control', test: desc, expected: 'build passes', result: r.ok ? 'PASS' : 'FAIL', message: r.ok ? `ok${r.problems.length ? ' (amber: ' + r.problems.map((p) => p.guard).join(', ') + ')' : ''}` : r.problems.filter((p) => p.level === 'fail').map((p) => p.msg).join(' | ') });
}
// CLI exit code: the real command exits 1 on a broken config.
let exit = 0;
try { execFileSync('node', ['build.mjs', '--client-dir', path.join(TMP, 'G6', 'client'), '--out', path.join(TMP, 'G6', 'cli'), '--quiet'], { cwd: ROOT, stdio: 'ignore' }); } catch (e) { exit = e.status; }
rows.push({ id: 'CLI', guard: 'Control', test: 'node build.mjs exits non-zero on a broken config', expected: 'exit 1', result: exit === 1 ? 'PASS' : 'FAIL', message: `exit ${exit}` });

const failed = rows.filter((r) => r.result !== 'PASS');
for (const r of rows) console.log(`${r.result.padEnd(4)} ${r.id.padEnd(5)} ${r.guard.padEnd(26)} ${r.test}\n           → ${r.message}`);
const caseRows = rows.filter((r) => r.guard !== 'Control');
console.log(`\nDeliberate-failure tests: ${caseRows.filter((r) => r.result === 'PASS').length}/${caseRows.length} pass · controls: ${rows.length - caseRows.length - rows.filter((r) => r.guard === 'Control' && r.result !== 'PASS').length}/${rows.length - caseRows.length} pass`);
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/guard-tests.json'), JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
