#!/usr/bin/env node
// Propulsion master template build (v3, craft theme).
// Usage: node build.mjs <slug> [--preview] [--strict] [--out <dir>] [--others <dir>] [--client-dir <dir>] [--check-only] [--quiet]
//   --preview     Preview build: banner, noindex, X-Robots-Tag, form to the test inbox.
//   --strict      Gate B mode: any PENDING marker fails; internal reference clients are refused.
//   --others DIR  Extra folder of other clients' client.json files for the cross-client check
//                 (every other clients/<slug>/client.json is always included).
//   --check-only  Re-run the output guards on an existing build folder without rebuilding.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkConfig, loadOthers } from './src/guards-config.mjs';
import { checkOutput } from './src/guards-output.mjs';
import { normalize, imageRefs, ideasShown, heroKind } from './src/config.mjs';
import { processImages, makeIcons, nearDuplicate, NEAR_DUP } from './src/images.mjs';
import { renderPages, csp, noindex } from './src/render.mjs';
import { homeOrder } from './src/brief.mjs';
import { tokensCss, FONT_FILES, SERIF_FAMILIES } from './themes/craft/tokens.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const THEME_DIR = path.join(ROOT, 'themes', 'craft');

function fonts(cfg, clientDir, outDir) {
  const faces = [];
  const urls = {};
  const { display, text } = cfg.brand.fonts;
  const want = new Map();
  const add = (fam, w) => { if (!want.has(fam)) want.set(fam, new Set()); want.get(fam).add(w); };
  add(text, '400'); add(text, '500');
  if (cfg.variant === 'B') add(text, '500');
  add(display, SERIF_FAMILIES.has(display) ? '400' : '500');
  add(display, '400i');
  for (const [family, weights] of want) {
    const files = cfg.brand.fontFiles?.[family]
      ? Object.fromEntries(Object.entries(cfg.brand.fontFiles[family]).map(([w, f]) => [w, path.join(clientDir, f)]))
      : Object.fromEntries(Object.entries(FONT_FILES[family] || {}).map(([w, f]) => [w, path.join(ROOT, f)]));
    for (const w of weights) {
      const src = files[w];
      if (!src) continue; // e.g. no italic for a sans family: the browser keeps the upright face
      const name = `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${w}.woff2`;
      fs.mkdirSync(path.join(outDir, 'assets', 'fonts'), { recursive: true });
      fs.copyFileSync(src, path.join(outDir, 'assets', 'fonts', name));
      urls[`${family}|${w}`] = `/assets/fonts/${name}`;
      const italic = w.endsWith('i');
      faces.push(`@font-face{font-family:"${family}";font-style:${italic ? 'italic' : 'normal'};font-weight:${parseInt(w, 10)};font-display:swap;src:url(/assets/fonts/${name}) format("woff2")}`);
    }
  }
  const headingKey = cfg.variant === 'B' ? `${text}|500` : `${display}|${SERIF_FAMILIES.has(display) ? '400' : '500'}`;
  return { faces, preloads: [...new Set([urls[`${text}|400`], urls[headingKey]])].filter(Boolean) };
}

// Light minify: comments and whitespace only. The CSS is hand-written and compiled here, never a CDN.
const minify = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}');
const hashFiles = (dir) => new Set(fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')) : []);

export async function build({ slug, clientDir, outDir, preview = false, strict = false, othersDir, keepMetadata = false, checkOnly = false, root = ROOT }) {
  clientDir = clientDir || path.join(root, 'clients', slug);
  const cfgPath = path.join(clientDir, 'client.json');
  if (!fs.existsSync(cfgPath)) return { ok: false, problems: [{ guard: 'Config', level: 'fail', msg: `No client.json at ${cfgPath}.` }] };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { return { ok: false, problems: [{ guard: 'Config', level: 'fail', msg: `client.json is not valid JSON: ${e.message}` }] }; }
  slug = slug || raw.slug;
  outDir = outDir || path.join(root, 'dist', preview ? `${slug}--preview` : slug);
  const others = loadOthers(raw.slug, root, othersDir);
  const problems = checkConfig(raw, { clientDir, strict, preview, others });
  const hard = () => problems.some((p) => p.level === 'fail');
  const done = () => ({ ok: !hard(), problems, outDir, cfg: raw });
  if (hard()) return done(); // never render a config that breaks a rule
  const cfg = normalize(raw);

  // A supplier image (Ideas page) must never stand in for the client's own work, even cropped.
  const refs = imageRefs(cfg);
  const supplier = refs.filter((r) => r.supplier);
  const own = refs.filter((r) => r.own);
  for (const o of own) for (const s of supplier) {
    const d = await nearDuplicate(path.join(clientDir, 'images', o.src), path.join(clientDir, 'images', s.src));
    if (d <= NEAR_DUP) problems.push({ guard: 'Supplier as own work', level: 'fail', msg: `${o.where} ("${o.src}") is the same picture as supplier image "${s.src}" (distance ${d}/256). Supplier images only appear on the Ideas page, labelled. Use the client's own photo.` });
  }
  if (hard()) return done();

  if (!checkOnly) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
    const shown = new Set(ideasShown(cfg).map((i) => i.src));
    const toBuild = refs.filter((r) => !r.supplier || shown.has(r.src));
    const { map: imgs, problems: ip } = await processImages(toBuild, { clientDir, outDir, quality: cfg.images?.quality ?? 72, keepMetadata });
    problems.push(...ip);
    if (hard()) return done();
    await makeIcons(outDir, cfg.brand.colors.dark, cfg.brand.colors.accent);
    const f = fonts(cfg, clientDir, outDir);
    const css = f.faces.join('\n') + '\n' + tokensCss({ colors: cfg.brand.colors, fonts: cfg.brand.fonts, radius: cfg.brand.radius, shadow: cfg.brand.shadow }) + minify(fs.readFileSync(path.join(THEME_DIR, 'theme.css'), 'utf8'));
    fs.writeFileSync(path.join(outDir, 'assets', 'site.css'), css);
    fs.copyFileSync(path.join(THEME_DIR, 'site.js'), path.join(outDir, 'assets', 'site.js'));
    const heroImg = cfg.hero.image && imgs[`${cfg.hero.image.src}|${heroKind(cfg)}`];
    const ctx = { preview, fontPreloads: f.preloads, ogImage: heroImg?.[heroImg.length - 1]?.url };
    const pages = renderPages(cfg, imgs, ctx);
    for (const [file, html] of Object.entries(pages)) {
      fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
      fs.writeFileSync(path.join(outDir, file), html);
    }
    const domain = cfg.domain.replace(/\/$/, '');
    const today = new Date().toISOString().slice(0, 10);
    const routes = Object.keys(pages).filter((p) => p !== '404.html').map((p) => '/' + p.replace(/index\.html$/, ''));
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${domain}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
    const hidden = noindex(cfg, ctx);
    fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\n${cfg.internalReference ? 'Disallow: /' : 'Allow: /'}\n\nSitemap: ${domain}/sitemap.xml\n`);
    const headers = [
      { key: 'Content-Security-Policy', value: csp(cfg, preview) + "; frame-ancestors 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
    ];
    if (hidden) headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    fs.writeFileSync(path.join(outDir, 'vercel.json'), JSON.stringify({
      trailingSlash: true,
      redirects: (cfg.redirects || []).map((r) => ({ source: r.from, destination: r.to, permanent: true })),
      headers: [{ source: '/(.*)', headers }, { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }],
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify({
      slug: cfg.slug, templateVersion: TEMPLATE_VERSION, theme: cfg.theme, variant: cfg.variant, layout: cfg.layout, preview, strict,
      internalReference: cfg.internalReference === true, builtAt: new Date().toISOString(), routes,
      redirects: (cfg.redirects || []).map((r) => [r.from, r.to]), homeOrder: homeOrder(cfg),
    }, null, 2));
  }
  problems.push(...checkOutput(outDir, raw, { strict, preview, others, selfHashes: hashFiles(path.join(clientDir, 'images')) }));
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
