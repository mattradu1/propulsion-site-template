// Direct-request routing check over HTTP (Darren's preview: one JS shell for every route, sub-paths 404 on
// direct request, unknown URLs returned 200). For every route: direct GET is 200 with that page's own
// <title> and canonical; the no-trailing-slash form redirects to it; every old-site redirect lands on a 200;
// every sitemap URL (mapped to the local server) is 200; an unknown URL is a real 404.
// Usage: node scripts/routes.mjs <slug> [--dir dist/<slug>]   → reports/routes-<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

export async function checkRoutes(dir, cfg) {
  const info = JSON.parse(fs.readFileSync(path.join(dir, 'build-info.json'), 'utf8'));
  const { server, url } = await serve(dir);
  const domain = cfg.domain.replace(/\/$/, '');
  const rows = [];
  const add = (check, ok, detail) => rows.push({ check, result: ok ? 'PASS' : 'FAIL', detail });
  const get = (p, redirect = 'manual') => fetch(url + p, { redirect, cache: 'no-store' });
  const titles = new Set();
  for (const r of info.routes) {
    const res = await get(r);
    const html = await res.text();
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    add(`GET ${r}`, res.status === 200 && !!title && !titles.has(title) && canon === domain + r, `status ${res.status}, title "${title}", canonical ${canon}`);
    titles.add(title);
    if (r !== '/') {
      const bare = r.replace(/\/$/, '');
      const rr = await get(bare);
      const follow = await get(bare, 'follow');
      add(`GET ${bare} (no slash)`, [301, 308].includes(rr.status) && rr.headers.get('location') === r && follow.status === 200, `status ${rr.status} → ${rr.headers.get('location')} → ${follow.status}`);
    }
  }
  for (const [from, to] of info.redirects || []) {
    const rr = await get(from);
    const follow = await get(from, 'follow');
    add(`Old URL ${from}`, [301, 308].includes(rr.status) && rr.headers.get('location') === to && follow.status === 200, `status ${rr.status} → ${rr.headers.get('location')} → ${follow.status}`);
  }
  const locs = [...fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const l of locs) { const res = await get(l.slice(domain.length)); add(`Sitemap ${l}`, res.status === 200, `status ${res.status}`); }
  const nf = await get('/__does-not-exist__/');
  add('Unknown URL is a real 404', nf.status === 404, `status ${nf.status}`);
  const nf2 = await get('/our-work/');
  if (!info.routes.includes('/our-work/')) add('Unknown sub-path is a real 404', nf2.status === 404, `status ${nf2.status}`);
  server.close();
  return rows;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  const i = process.argv.indexOf('--dir');
  const dir = path.resolve(i > 0 ? process.argv[i + 1] : `dist/${slug}`);
  const cfg = JSON.parse(fs.readFileSync(`clients/${slug}/client.json`, 'utf8'));
  const rows = await checkRoutes(dir, cfg);
  const fails = rows.filter((r) => r.result === 'FAIL');
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(`reports/routes-${slug}.json`, JSON.stringify({ slug, ranAt: new Date().toISOString(), rows }, null, 2));
  for (const f of fails) console.log(`FAIL ${f.check}: ${f.detail}`);
  console.log(`Routes ${slug}: ${rows.length} checks · ${fails.length} FAIL`);
  process.exit(fails.length ? 1 : 0);
}
