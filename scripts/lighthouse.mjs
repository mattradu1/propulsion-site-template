// Local Lighthouse (PageSpeed Insights API is blocked). Mobile emulation, simulated throttling.
// Usage: node scripts/lighthouse.mjs <slug>  → reports/lighthouse-<slug>-{perf,full}.json + summary
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
import { serve } from './serve.mjs';
import { CHROME, CHROME_FLAGS } from './browser.mjs';

const slug = process.argv[2] || 'test-roofing';
const dir = path.resolve('dist', slug);
const { server, url } = await serve(dir);
fs.mkdirSync('reports', { recursive: true });
const bin = path.resolve('node_modules/.bin/lighthouse');
const flags = `--headless=new ${CHROME_FLAGS.join(' ')}`;
const env = { ...process.env, CHROME_PATH: CHROME };
const run = async (name, extra, page = '/') => {
  const out = path.resolve(`reports/lighthouse-${slug}-${name}.json`);
  await execFileP(bin, [url + page, '--quiet', '--output=json', `--output-path=${out}`, `--chrome-flags=${flags}`, '--form-factor=mobile', '--screenEmulation.mobile', ...extra], { env, timeout: 240000, maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(fs.readFileSync(out, 'utf8'));
};
const summary = {};
const pick = (r) => ({
  performance: r.categories.performance && Math.round(r.categories.performance.score * 100),
  accessibility: r.categories.accessibility && Math.round(r.categories.accessibility.score * 100),
  bestPractices: r.categories['best-practices'] && Math.round(r.categories['best-practices'].score * 100),
  seo: r.categories.seo && Math.round(r.categories.seo.score * 100),
  lcp: r.audits['largest-contentful-paint']?.displayValue,
  cls: r.audits['cumulative-layout-shift']?.displayValue,
  tbt: r.audits['total-blocking-time']?.displayValue,
  fcp: r.audits['first-contentful-paint']?.displayValue,
  lcpMs: Math.round(r.audits['largest-contentful-paint']?.numericValue ?? 0),
  clsValue: r.audits['cumulative-layout-shift']?.numericValue,
  // SEO with the deliberate noindex left out (internal reference and preview builds are noindex on purpose).
  seoExNoindex: r.categories.seo && (() => {
    const refs = r.categories.seo.auditRefs.filter((a) => a.weight > 0 && a.id !== 'is-crawlable' && r.audits[a.id]?.score != null);
    return Math.round(100 * refs.reduce((s, a) => s + a.weight * r.audits[a.id].score, 0) / refs.reduce((s, a) => s + a.weight, 0));
  })(),
  failedAudits: Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary').map((a) => a.id),
});
try {
  summary.perf = pick(await run('perf', ['--only-categories=performance']));
  summary.full = pick(await run('full', []));
  for (const p of JSON.parse(fs.readFileSync(path.join(dir, 'build-info.json'), 'utf8')).routes.filter((r) => r !== '/'))
    summary['full ' + p] = pick(await run('full' + p.replace(/\//g, '-').replace(/-$/, ''), [], p));
} finally { server.close(); }
fs.writeFileSync(`reports/lighthouse-${slug}-summary.json`, JSON.stringify({ ranAt: new Date().toISOString(), url: 'local static server (vercel.json headers applied)', mode: 'mobile, simulated throttling (Lighthouse default)', summary }, null, 2));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(16), JSON.stringify(v));
const p = summary.perf;
const all = Object.values(summary);
const ok = p.performance >= 85 && p.lcpMs <= 2500 && p.clsValue <= 0.1 && all.every((x) => x.accessibility == null || x.accessibility >= 95);
console.log(ok ? 'Lighthouse: meets Definition of Done' : 'Lighthouse: BELOW Definition of Done');
process.exit(ok ? 0 : 1);
