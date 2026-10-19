#!/usr/bin/env node
// Propulsion master template build.
// Usage: node build.mjs <slug> [--preview] [--strict] [--out <dir>] [--others <dir>] [--client-dir <dir>] [--check-only] [--quiet]
//   --preview     Preview build: banner, noindex, X-Robots-Tag, form to the test inbox.
//   --strict      Gate B mode: any PENDING marker or amber-level pending item fails.
//   --others DIR  Extra folder of other clients' client.json files for the cross-client check
//                 (every other clients/<slug>/client.json is always included).
//   --check-only  Re-run the output guards on an existing build folder without rebuilding.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkConfig, loadOthers, imageRefs } from './src/guards-config.mjs';
import { checkOutput } from './src/guards-output.mjs';
import { processImages, makeIcons } from './src/images.mjs';
import { renderPages, csp } from './src/render.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const DEFAULT_FONTS = {
  'Inter': { 400: 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 600: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 700: 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2' },
  'Source Serif 4': { 600: 'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2' },
};
const FALLBACK = { sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif' };

function fonts(cfg, clientDir, outDir) {
  const faces = [];
  const urls = {};
  for (const [role, family] of Object.entries(cfg.brand.fonts || {})) {
    const files = cfg.brand.fontFiles?.[family]
      ? Object.fromEntries(Object.entries(cfg.brand.fontFiles[family]).map(([w, f]) => [w, path.join(clientDir, f)]))
      : Object.fromEntries(Object.entries(DEFAULT_FONTS[family] || {}).map(([w, f]) => [w, path.join(ROOT, f)]));
    if (!Object.keys(files).length) throw new Error(`Font "${family}" has no files. Add brand.fontFiles["${family}"] with self-hosted .woff2 files in clients/${cfg.slug}/fonts/.`);
    for (const [w, src] of Object.entries(files)) {
      const name = `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${w}.woff2`;
      fs.mkdirSync(path.join(outDir, 'assets', 'fonts'), { recursive: true });
      fs.copyFileSync(src, path.join(outDir, 'assets', 'fonts', name));
      urls[`${role}-${w}`] = `/assets/fonts/${name}`;
      faces.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/fonts/${name}) format("woff2")}`);
    }
  }
  return { faces, urls };
}

function tokensCss(cfg, faces) {
  const c = cfg.brand.colors;
  const q = (f) => `"${String(f).replace(/["\\;{}<>]/g, '')}"`;
  return `${faces.join('\n')}\n:root{--text:${c.text};--bg:${c.background};--surface:${c.surface};--accent:${c.accent};--accent-text:${c.accentText};--muted:${c.muted};--font-sans:${q(cfg.brand.fonts.sans)},${FALLBACK.sans};--font-serif:${q(cfg.brand.fonts.serif || cfg.brand.fonts.sans)},${FALLBACK.serif}}\n`;
}

const hashFiles = (dir) => new Set(fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')) : []);

export async function build({ slug, clientDir, outDir, preview = false, strict = false, othersDir, keepMetadata = false, checkOnly = false, root = ROOT }) {
  clientDir = clientDir || path.join(root, 'clients', slug);
  const cfgPath = path.join(clientDir, 'client.json');
  if (!fs.existsSync(cfgPath)) return { ok: false, problems: [{ guard: 'Config', level: 'fail', msg: `No client.json at ${cfgPath}.` }] };
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { return { ok: false, problems: [{ guard: 'Config', level: 'fail', msg: `client.json is not valid JSON: ${e.message}` }] }; }
  slug = slug || cfg.slug;
  outDir = outDir || path.join(root, 'dist', preview ? `${slug}--preview` : slug);
  const others = loadOthers(cfg.slug, root, othersDir);
  const problems = checkConfig(cfg, { clientDir, strict, preview, others });
  const hard = () => problems.some((p) => p.level === 'fail');
  const done = () => ({ ok: !hard(), problems, outDir, cfg });
  if (hard()) return done(); // never render a config that breaks a rule
  cfg.pages = { work: true, services: true, about: true, ideas: false, ...(cfg.pages || {}) };

  if (!checkOnly) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
    const { map: imgs, problems: ip } = await processImages(imageRefs(cfg), { clientDir, outDir, quality: cfg.images?.quality ?? 72, keepMetadata });
    problems.push(...ip);
    if (hard()) return done();
    await makeIcons(outDir, cfg.brand.colors.accent);
    const f = fonts(cfg, clientDir, outDir);
    fs.writeFileSync(path.join(outDir, 'assets', 'site.css'), tokensCss(cfg, f.faces) + fs.readFileSync(path.join(ROOT, 'assets', 'site.css'), 'utf8'));
    fs.copyFileSync(path.join(ROOT, 'assets', 'site.js'), path.join(outDir, 'assets', 'site.js'));
    const headingFont = { A: 'sans-700', B: 'serif-600', C: 'sans-600' }[cfg.variant];
    const fontPreloads = [f.urls['sans-400'], f.urls[headingFont]].filter(Boolean);
    const heroImg = cfg.hero.image && imgs[cfg.hero.image.src];
    const pages = renderPages(cfg, imgs, { preview, fontPreloads, ogImage: heroImg?.[1]?.url });
    for (const [file, html] of Object.entries(pages)) {
      fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
      fs.writeFileSync(path.join(outDir, file), html);
    }
    const domain = cfg.domain.replace(/\/$/, '');
    const today = new Date().toISOString().slice(0, 10);
    const routes = Object.keys(pages).filter((p) => p !== '404.html').map((p) => '/' + p.replace(/index\.html$/, ''));
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${domain}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
    fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`);
    const headers = [
      { key: 'Content-Security-Policy', value: csp(cfg, preview) + "; frame-ancestors 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
    ];
    if (preview) headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    fs.writeFileSync(path.join(outDir, 'vercel.json'), JSON.stringify({
      trailingSlash: true,
      headers: [{ source: '/(.*)', headers }, { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }],
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify({ slug: cfg.slug, templateVersion: TEMPLATE_VERSION, preview, strict, builtAt: new Date().toISOString(), routes }, null, 2));
  }
  problems.push(...checkOutput(outDir, cfg, { strict, preview, others, selfHashes: hashFiles(path.join(clientDir, 'images')) }));
  return done();
}

export function printReport(res, { quiet } = {}) {
  const fails = res.problems.filter((p) => p.level === 'fail');
  const ambers = res.problems.filter((p) => p.level === 'amber');
  if (!quiet) {
    for (const p of fails) console.error(`FAIL  [${p.guard}] ${p.msg}`);
    for (const p of ambers) console.warn(`AMBER [${p.guard}] ${p.msg}`);
  }
  console.log(res.ok ? `\nBUILD OK${ambers.length ? ` with ${ambers.length} amber item(s)` : ''}: ${res.outDir}` : `\nBUILD FAILED: ${fails.length} problem(s). Nothing should be published from this build.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const slug = a.find((x, i) => !x.startsWith('--') && !['--out', '--others', '--client-dir'].includes(a[i - 1]));
  if (!slug && !opt('--client-dir')) { console.error('Usage: node build.mjs <slug> [--preview] [--strict] [--out dir] [--others dir] [--check-only]'); process.exit(2); }
  const res = await build({
    slug, preview: a.includes('--preview'), strict: a.includes('--strict'), checkOnly: a.includes('--check-only'),
    outDir: opt('--out') && path.resolve(opt('--out')), othersDir: opt('--others') && path.resolve(opt('--others')),
    clientDir: opt('--client-dir') && path.resolve(opt('--client-dir')),
    keepMetadata: a.includes('--unsafe-keep-metadata-for-tests'),
  });
  printReport(res, { quiet: a.includes('--quiet') });
  process.exit(res.ok ? 0 : 1);
}
