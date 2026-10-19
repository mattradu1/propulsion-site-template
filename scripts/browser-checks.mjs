// Real-browser checks at real widths (Website Build Standard: "verification runs programmatically in a real
// browser at real widths"). Every route, at phone, two tablet and desktop widths:
//   1 no sideways scroll (390px and up)          5 every image (incl. lazy ones) actually loads
//   2 tap targets: 44×44px, inline text links 24px  6 approved copy phrases visible on their page
//   3 computed font family is the self-hosted one  7 phone menu opens, traps focus, closes on Escape
//   4 at most six font sizes in use per width      8 day/evening toggle switches every pair, aria-pressed in step
// Usage: node scripts/browser-checks.mjs <slug> [--dir dist/<slug>]   → reports/browser-<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { launch, routesOf } from './browser.mjs';

export const VIEWPORTS = [
  { n: 'phone-390', width: 390, height: 844 },
  { n: 'tablet-768', width: 768, height: 1024 },
  { n: 'tablet-834', width: 834, height: 1112 },
  { n: 'tablet-1024', width: 1024, height: 768 },
  { n: 'desktop-1280', width: 1280, height: 900 },
];

export async function runChecks(dir, cfg, { browser, viewports = VIEWPORTS } = {}) {
  const own = !browser;
  browser = browser || await launch();
  const { server, url } = await serve(dir);
  const routes = [...routesOf(dir), '/404.html'];
  const fonts = cfg.brand.fonts;
  const want = { body: fonts.text, h1: cfg.variant === 'B' ? fonts.text : fonts.display };
  const phrases = (cfg.copyPhrases || []).map((c) => (typeof c === 'string' ? { phrase: c } : c));
  const results = [];
  const add = (vp, route, check, ok, detail) => results.push({ viewport: vp, route, check, result: ok ? 'PASS' : 'FAIL', detail });
  const phraseSeen = new Map(phrases.map((p) => [p.phrase, false]));

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce', hasTouch: vp.width < 1100 });
    for (const route of routes) {
      const page = await ctx.newPage();
      await page.goto(url + route, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Scroll the whole page so lazy images load, then come back.
      await page.evaluate(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(150);
      const r = await page.evaluate(({ want }) => {
        const vis = (e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
        const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        // 2 tap targets
        const small = [];
        for (const e of document.querySelectorAll('a[href],button,summary,input:not([type=hidden]),select,textarea,label.consent')) {
          if (!vis(e) || e.classList.contains('skip')) continue;
          if (e.tagName === 'INPUT' && e.closest('label')) continue; // the label is the target
          const b = e.getBoundingClientRect();
          const inline = getComputedStyle(e).display === 'inline' && e.parentElement && e.parentElement.textContent.trim().length > e.textContent.trim().length;
          const ok = inline ? b.height >= 24 : b.width >= 44 && b.height >= 44;
          if (!ok) small.push(`${(e.innerText || e.getAttribute('aria-label') || e.name || e.tagName).trim().slice(0, 30)} ${Math.round(b.width)}×${Math.round(b.height)}${inline ? ' (inline)' : ''}`);
        }
        // 4 font sizes in use
        const sizes = new Set();
        for (const e of document.querySelectorAll('body *')) {
          if (!vis(e)) continue;
          if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) sizes.add(getComputedStyle(e).fontSize);
        }
        // 3 font family (computed) and actually loaded
        const h1 = document.querySelector('h1');
        const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
        // 5 images
        const broken = [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src'));
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          small, sizes: [...sizes],
          bodyFont: fam(document.body), h1Font: h1 ? fam(h1) : null, loaded: [...new Set(loaded)],
          fontsOk: document.fonts.check(`16px "${want.body}"`) && document.fonts.check(`16px "${want.h1}"`),
          broken, text: document.body.innerText,
        };
      }, { want });
      add(vp.n, route, 'No sideways scroll', r.overflow <= 0, r.overflow > 0 ? `${r.overflow}px wider than the screen` : 'ok');
      add(vp.n, route, 'Tap targets 44px (inline text links 24px)', r.small.length === 0, r.small.join(' | ') || 'ok');
      add(vp.n, route, 'Computed fonts are the self-hosted families', r.bodyFont === want.body && r.h1Font === want.h1 && r.fontsOk && r.loaded.includes(want.body),
        `body ${r.bodyFont}, h1 ${r.h1Font}, loaded: ${r.loaded.join(', ')}`);
      add(vp.n, route, 'Six font sizes at most', r.sizes.length <= 6, `${r.sizes.length}: ${r.sizes.join(' ')}`);
      add(vp.n, route, 'Every image loads (lazy included)', r.broken.length === 0, r.broken.join(', ') || 'ok');
      for (const p of phrases) if ((!p.page || p.page === route) && r.text.replace(/\s+/g, ' ').includes(p.phrase)) phraseSeen.set(p.phrase, true);

      // 7 phone menu
      if (vp.width < 1100 && route === '/') {
        const m = await page.evaluate(async () => {
          const burger = document.querySelector('.burger'); const nav = document.getElementById('primary-nav');
          if (!burger || !nav) return { ok: false, d: 'no burger/nav' };
          burger.click(); await new Promise((r) => setTimeout(r, 50));
          const open = nav.classList.contains('is-open') && getComputedStyle(nav).display !== 'none' && burger.getAttribute('aria-expanded') === 'true' && nav.contains(document.activeElement);
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 50));
          const closed = !nav.classList.contains('is-open') && burger.getAttribute('aria-expanded') === 'false' && document.activeElement === burger;
          return { ok: open && closed, d: `opens ${open}, closes on Escape with focus back ${closed}` };
        });
        add(vp.n, route, 'Phone menu opens, holds focus, closes on Escape', m.ok, m.d);
      }
      // 8 day/evening toggle
      const hasToggle = await page.$('.lighting button[data-mode=evening]');
      if (hasToggle && vp.n === 'phone-390' && !(await hasToggle.isVisible())) add(vp.n, route, 'Day/evening toggle switches every pair', false, 'toggle never appeared (site.js did not run)');
      else if (hasToggle && vp.n === 'phone-390') {
        await hasToggle.click();
        const t = await page.evaluate(() => {
          const sec = document.querySelector('.lighting').closest('.work');
          const pairs = [...sec.querySelectorAll('.pair')].filter((p) => p.querySelector('.eve'));
          const shown = pairs.every((p) => getComputedStyle(p.querySelector('.eve')).opacity === '1' && p.querySelector('.eve').getAttribute('aria-hidden') === 'false' && p.querySelector('.day').getAttribute('aria-hidden') === 'true');
          const pressed = sec.querySelector('[data-mode=evening][aria-pressed=true]') && sec.querySelector('button[data-mode=day][aria-pressed=false]');
          return { ok: sec.dataset.mode === 'evening' && shown && !!pressed, d: `${pairs.length} pairs switched ${shown}, aria-pressed ${!!pressed}` };
        });
        add(vp.n, route, 'Day/evening toggle switches every pair', t.ok, t.d);
      }
      await page.close();
    }
    await ctx.close();
  }
  for (const [p, seen] of phraseSeen) add('all', 'all', `Copy phrase visible: "${p.slice(0, 50)}"`, seen, seen ? 'ok' : 'not visible on its page');
  server.close();
  if (own) await browser.close();
  return results;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  const i = process.argv.indexOf('--dir');
  const dir = path.resolve(i > 0 ? process.argv[i + 1] : `dist/${slug}`);
  const cfg = JSON.parse(fs.readFileSync(`clients/${slug}/client.json`, 'utf8'));
  const results = await runChecks(dir, cfg);
  const fails = results.filter((r) => r.result === 'FAIL');
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(`reports/browser-${slug}.json`, JSON.stringify({ slug, ranAt: new Date().toISOString(), pass: results.length - fails.length, fail: fails.length, results }, null, 2));
  for (const f of fails) console.log(`FAIL ${f.viewport} ${f.route} — ${f.check}: ${f.detail}`);
  const by = (c) => results.filter((r) => r.check.startsWith(c));
  console.log(`Browser checks ${slug}: ${results.length} checks · ${fails.length} FAIL · overflow ${by('No sideways').filter((r) => r.result === 'PASS').length}/${by('No sideways').length} · tap ${by('Tap').filter((r) => r.result === 'PASS').length}/${by('Tap').length}`);
  process.exit(fails.length ? 1 : 0);
}
