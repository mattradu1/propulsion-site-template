// Real-browser checks at real widths (Website Build Standard: "verification runs programmatically in a real
// browser at real widths"). Every route, at phone, two tablet and desktop widths:
//   1 no sideways scroll (390px and up)          5 every image (incl. lazy ones) actually loads
//   2 tap targets: 44×44px, inline text links 24px  6 approved copy phrases visible on their page
//   3 computed font family is the self-hosted one  7 phone menu opens, traps focus, closes on Escape
//   4 at most six font sizes in use per width      8 day/evening toggle switches every pair, aria-pressed in step
// v3: 9 reduced motion = final state (words, process line, counters)   10 before/after drag + tap moves the slider
//     11 JavaScript off at 390px: H1 text there, both before/after photos side by side, no sideways scroll
//     12 motion on (desktop): words settle, process line draws to the end, counters land on their figure
// v4 (mobile first: 360, 390 and 414 are the primary widths):
//     13 action bar: hidden over the hero, shown mid-page, never over the form, closing band or footer, 44px
//     14 body text and form fields 16px+ (no iOS zoom), right keyboards   15 form: messages in place, no shift,
//        focus to the first problem, success panel with the client's next step (processor stubbed locally)
//     16 View Transitions on page change only without reduced motion   17 spring: tap glides, then lands
// Usage: node scripts/browser-checks.mjs <slug> [--dir dist/<slug>]   → reports/browser-<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { launch, routesOf } from './browser.mjs';

export const VIEWPORTS = [
  { n: 'phone-360', width: 360, height: 780 },
  { n: 'phone-390', width: 390, height: 844 },
  { n: 'phone-414', width: 414, height: 896 },
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
      // 14 mobile type: body 16px+, form fields 16px+ (iOS zooms below that) with the right keyboard
      if (vp.width < 768) {
        const mt = await page.evaluate(() => {
          const px = (e) => parseFloat(getComputedStyle(e).fontSize);
          const f = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),textarea')];
          return { body: px(document.body), small: f.filter((i) => px(i) < 16).map((i) => i.name + ' ' + px(i)), kb: f.filter((i) => (i.name === 'email' && i.type !== 'email') || (i.name === 'phone' && i.type !== 'tel')).map((i) => i.name) };
        });
        add(vp.n, route, 'Mobile type: body and form fields 16px+, right keyboards', mt.body >= 16 && !mt.small.length && !mt.kb.length, `body ${mt.body}px; small fields ${mt.small.join(', ') || 'none'}; wrong keyboard ${mt.kb.join(', ') || 'none'}`);
      }
      // 13 action bar (phones): never over the form, closing band or footer; shown mid-page; 44px targets
      if (vp.width < 768 && (await page.$('[data-actionbar]'))) {
        const ab = await page.evaluate(async () => {
          const bar = document.querySelector('[data-actionbar]');
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const shown = () => bar.classList.contains('is-shown') && getComputedStyle(bar).visibility !== 'hidden' && bar.getBoundingClientRect().top < innerHeight - 1;
          const out = { atTop: null, mid: false, covers: [], small: [] };
          window.scrollTo(0, 0); await wait(200); out.atTop = shown();
          for (const sel of ['#enquire', '.cta-band', '.site-footer']) for (const el of document.querySelectorAll(sel)) for (const pos of ['start', 'center', 'end']) {
            el.scrollIntoView({ block: pos }); await wait(200);
            const b = bar.getBoundingClientRect(), e = el.getBoundingClientRect();
            if (shown() && e.top < b.bottom && e.bottom > b.top + 0.5) out.covers.push(`${sel}@${pos}`);
          }
          // At every half-screen step the bar must match the rule: shown only when the opening section has gone and
          // no form, closing band or footer is on screen or within 96px of it.
          const H = document.documentElement.scrollHeight - innerHeight, first = document.querySelector('main > :first-child');
          out.wrong = [];
          for (let y = 0; y <= H; y += innerHeight / 2) {
            window.scrollTo(0, y); await wait(200);
            const zoneNear = [...document.querySelectorAll('#enquire, .cta-band, .site-footer')].some((z) => { const r = z.getBoundingClientRect(); return r.top < innerHeight + 96 && r.bottom > 0; });
            const want = first.getBoundingClientRect().bottom <= 0 && !zoneNear;
            if (want !== shown()) out.wrong.push(`${Math.round(y)}px ${shown() ? 'shown' : 'hidden'}`);
            if (shown()) { out.mid = true; out.small.push(...[...bar.querySelectorAll('a')].map((a) => a.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`)); }
          }
          window.scrollTo(0, 0); await wait(100);
          return { ...out, long: H > innerHeight * 2.5 };
        });
        add(vp.n, route, 'Action bar: hidden over the opening, never over form/band/footer, shown in between, 44px', !ab.atTop && !ab.covers.length && !ab.small.length && !ab.wrong.length,
          `at top ${ab.atTop ? 'SHOWN' : 'hidden'}, covers ${ab.covers.join(', ') || 'nothing'}, shown somewhere ${ab.mid}, off-rule at ${ab.wrong.slice(0, 4).join('; ') || 'no step'}, small ${[...new Set(ab.small)].join(', ') || 'none'}`);
      }
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
      // 9 reduced motion: everything already in its final state
      if (route === '/' || route === '/work/') {
        const rm = await page.evaluate(() => {
          const words = [...document.querySelectorAll('.hero h1 .w')].filter((w) => { const s = getComputedStyle(w); return s.transform !== 'none' || s.filter !== 'none'; }).length;
          const drawOn = document.querySelectorAll('.steps.draw-on').length;
          const counts = [...document.querySelectorAll('[data-count]')].filter((e) => e.textContent.replace(/\D/g, '') !== e.getAttribute('data-count')).length;
          const risen = [...document.querySelectorAll('.rise, .pair img')].filter((e) => getComputedStyle(e).transform !== 'none').length; // v4
          return { ok: !words && !drawOn && !counts && !risen, d: `words moved ${words}, process line hidden ${drawOn}, counters off their figure ${counts}, reveals not in place ${risen}` };
        });
        add(vp.n, route, 'Reduced motion shows the final state', rm.ok, rm.d);
      }
      // 10 before/after: drag with a mouse, tap on touch screens
      const ba = await page.$('[data-ba]');
      if (ba && (vp.n === 'phone-390' || vp.n === 'desktop-1280')) {
        await ba.scrollIntoViewIfNeeded();
        const b = await ba.boundingBox();
        const val = () => page.$eval('[data-ba] [role=slider]', (e) => +e.getAttribute('aria-valuenow'));
        let d1, d2;
        if (vp.width < 1100) { await page.touchscreen.tap(b.x + b.width * 0.8, b.y + b.height / 2); d1 = await val(); await page.touchscreen.tap(b.x + b.width * 0.2, b.y + b.height / 2); d2 = await val(); }
        else { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.8, b.y + b.height / 2, { steps: 4 }); d1 = await val(); await page.mouse.move(b.x + b.width * 0.2, b.y + b.height / 2, { steps: 4 }); d2 = await val(); await page.mouse.up(); }
        const clip = await page.$eval('[data-ba] .ba-before', (e) => getComputedStyle(e).clipPath);
        add(vp.n, route, 'Before/after slider follows pointer and touch', Math.abs(d1 - 80) <= 3 && Math.abs(d2 - 20) <= 3 && /inset/.test(clip), `to 80% → ${d1}, to 20% → ${d2}, clip ${clip}`);
      }
      await page.close();
    }
    await ctx.close();
  }
  // 11 JavaScript off, phone width (the no-JS fallback)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    for (const route of routes.filter((r) => r === '/' || r === '/work/')) {
      const page = await ctx.newPage();
      await page.goto(url + route, { waitUntil: 'load' });
      const r = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const ba = [...document.querySelectorAll('[data-ba]')].map((b) => { const p = [...b.querySelectorAll('.ba-pane')].map((x) => x.getBoundingClientRect()); return p.length === 2 && Math.abs(p[0].top - p[1].top) < 1 && p[0].width > 100 && p[1].width > 100 && p[1].left >= p[0].right; });
        const handleShown = [...document.querySelectorAll('.ba-handle')].some((x) => x.getClientRects().length);
        return { overflow: document.documentElement.scrollWidth - innerWidth, h1: (h1?.textContent || '').trim().length, ba, handleShown };
      });
      add('nojs-390', route, 'No JavaScript: H1, content and before/after side by side', r.overflow <= 0 && r.h1 > 0 && r.ba.every(Boolean) && !r.handleShown, `overflow ${r.overflow}px, H1 ${r.h1} chars, pairs side by side ${r.ba.join(',') || 'none on page'}, slider hidden ${!r.handleShown}`);
      await page.close();
    }
    await ctx.close();
  }
  // 15 Enquiry form at 390px (JS on): messages in place, no shift, focus to the first problem; inline success
  if (routes.includes('/consultation/')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const action = await (async () => { await page.goto(url + '/consultation/', { waitUntil: 'load' }); return page.$eval('form[data-enquiry]', (f) => f.action).catch(() => null); })();
    if (action) {
      // Stub the form processor locally (nothing leaves the machine): answers the CORS preflight and the post.
      await page.route(new URL(action).origin + '/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'x-requested-with, accept', 'access-control-allow-methods': 'POST', 'content-type': 'application/json' }, body: '{"ok":true}' }));
      const inline = await page.$eval('form[data-enquiry]', (f) => f.hasAttribute('data-inline'));
      const f1 = await page.evaluate(async () => {
        const form = document.querySelector('form[data-enquiry]'); const stack = form.parentNode;
        const h0 = stack.getBoundingClientRect().height;
        form.querySelector('[type=submit]').click(); await new Promise((r) => setTimeout(r, 100));
        const shown = [...form.querySelectorAll('.err')].filter((p) => !p.hidden).map((p) => p.id);
        const h1 = stack.getBoundingClientRect().height;
        return { shown, focus: document.activeElement.id, invalid: form.querySelectorAll('[aria-invalid=true]').length, shift: Math.abs(h1 - h0), novalidate: form.noValidate };
      });
      add('phone-390', '/consultation/', 'Form: messages under each field, focus to the first, no layout shift', f1.novalidate && f1.shown.join(',') === 'f-name-err,f-email-err,f-consent-err' && f1.focus === 'f-name' && f1.invalid === 3 && f1.shift < 1,
        `shown ${f1.shown.join(',') || 'none'}, focus #${f1.focus}, aria-invalid ${f1.invalid}, height change ${f1.shift}px`);
      await page.fill('#f-name', 'DEMO Tester'); await page.fill('#f-email', 'not-an-email'); await page.locator('#f-email').blur();
      const bad = await page.$eval('#f-email-bad', (e) => !e.hidden);
      await page.fill('#f-email', 'demo@example.com'); await page.check('#f-consent');
      const cleared = await page.evaluate(() => document.querySelectorAll('form[data-enquiry] [aria-invalid=true]').length);
      add('phone-390', '/consultation/', 'Form: a bad email is flagged, fixing it clears the message', bad && cleared === 0, `bad email flagged ${bad}, still invalid after fixing ${cleared}`);
      if (inline) {
        const h0 = await page.$eval('.enq-stack', (e) => e.getBoundingClientRect().height);
        await page.click('form[data-enquiry] [type=submit]');
        await page.waitForSelector('.sent:not([hidden])', { timeout: 3000 }).catch(() => {});
        const s2 = await page.evaluate(() => { const p = document.querySelector('.sent'), st = document.querySelector('.enq-stack'); return { shown: !!p && !p.hidden, text: p ? p.innerText : '', focus: document.activeElement?.id, url: location.pathname, h: st ? st.getBoundingClientRect().height : -1 }; }).catch(() => ({ shown: false, text: '', url: 'navigated away', h: -1 }));
        const next = cfg.form?.nextStep;
        add('phone-390', '/consultation/', 'Form: success panel in place with the client\'s next step', s2.shown && s2.url === '/consultation/' && s2.focus === 'enq-sent-h' && (!next || s2.text.includes(next)) && Math.abs(s2.h - h0) < 1,
          `panel ${s2.shown}, still on ${s2.url}, focus #${s2.focus}, next step ${next ? s2.text.includes(next) : 'not set'}, height change ${Math.round(Math.abs(s2.h - h0))}px`);
      }
    }
    await ctx.close();
  }
  // 16 View Transitions: on for a page change with motion, off under reduced motion
  if (routes.length > 1) {
    const vt = {};
    for (const rm of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm });
      const page = await ctx.newPage();
      await page.goto(url + '/', { waitUntil: 'load' });
      await page.evaluate(() => { window.addEventListener('pageswap', (e) => { sessionStorage.setItem('vt', e.viewTransition ? 'yes' : 'no'); }); });
      const href = routes.find((r) => r !== '/' && r !== '/404.html');
      await page.evaluate((h) => { const a = document.createElement('a'); a.href = h; a.textContent = 'x'; document.body.append(a); a.click(); }, href);
      await page.waitForURL('**' + href, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      vt[rm] = await page.evaluate(() => sessionStorage.getItem('vt'));
      await ctx.close();
    }
    add('motion', 'page change', 'View Transitions: on with motion, off under reduced motion', vt['no-preference'] === 'yes' && vt.reduce !== 'yes', `motion ${vt['no-preference']}, reduced ${vt.reduce}`);
  }
  // 17 Spring (motion on, 390px): a tap glides to the point, passing through the values in between, then lands
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    for (const route of routes.filter((r) => r === '/' || r === '/work/')) {
      await page.goto(url + route, { waitUntil: 'load' });
      const ba = await page.$('[data-ba]');
      if (!ba) continue;
      await ba.scrollIntoViewIfNeeded(); await page.waitForTimeout(2600); // let the one-time signature glide finish
      const b = await ba.boundingBox();
      const v = () => page.$eval('[data-ba] [role=slider]', (e) => +e.getAttribute('aria-valuenow'));
      const start = await v();
      await page.touchscreen.tap(b.x + b.width * 0.85, b.y + b.height / 2);
      await page.waitForTimeout(90); const mid = await v();
      await page.waitForTimeout(1200); const end = await v();
      add('motion-390', route, 'Before/after spring: tap glides, then lands on the point', start === 50 && mid > start && mid < 84 && Math.abs(end - 85) <= 2, `start ${start}, after 90 ms ${mid}, settled ${end}`);
    }
    await ctx.close();
  }
  // 12 Motion on (desktop): runs once and lands on the final state
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(url + '/', { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    const words = await page.evaluate(() => [...document.querySelectorAll('.hero h1 .w')].filter((w) => getComputedStyle(w).transform !== 'none' || getComputedStyle(w).filter !== 'none').length);
    const iters = await page.evaluate(() => [...new Set([...document.querySelectorAll('.hero h1 .w')].map((w) => getComputedStyle(w).animationIterationCount))].join(','));
    await page.evaluate(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += 200) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
    await page.waitForTimeout(2200);
    const m = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('.rail-line')].map((p) => Math.round(parseFloat(getComputedStyle(p).strokeDashoffset) || 0)),
      unreached: document.querySelectorAll('.steps.draw-on li:not(.reached)').length,
      counts: [...document.querySelectorAll('[data-count]')].filter((e) => e.textContent.replace(/\D/g, '') !== e.getAttribute('data-count')).length,
      // v4: signature elements fully on screen have landed; nothing outside the signature moves on its own
      sigOff: [...document.querySelectorAll('.sig .rise')].filter((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).transform !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(getComputedStyle(e).transform); }).length,
      outside: [...document.querySelectorAll('.rise')].filter((e) => !e.closest('.sig') && getComputedStyle(e).animationName !== 'none').length,
    }));
    add('motion-1280', '/', 'Motion on: words settle once, line draws, counters land, one signature only', words === 0 && (iters === '1' || iters === '') && m.lines.every((x) => x === 0) && m.unreached === 0 && m.counts === 0 && m.sigOff === 0 && m.outside === 0,
      `words still moving ${words}, iterations ${iters || 'n/a'}, line offsets ${m.lines.join(',') || 'none'}, steps unreached ${m.unreached}, counters off ${m.counts}, signature not landed ${m.sigOff}, moving outside the signature ${m.outside}`);
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
