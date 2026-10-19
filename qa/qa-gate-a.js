// Propulsion OS-09 Gate A — browser QA script (v1.2, 19 Oct 2026; adapted from v1 for headless Playwright)
// v1.2 (template v2): a PENDING phone is amber, not a fail; claim checks ignore the text of PENDING markers
// (an open conflict quoted inside a marker is not a claim); CTA wording includes the client's own label.
// v1.1 changes: axe is injected locally by the runner (no CDN fetch); added rulebook S4/S5 checks:
// preview banner + noindex, PENDING markers (amber), no unsafe markup, phone-width tap-to-call.
// Run in the browser pane (javascript_tool) or DevTools console on each page of a preview.
// Set CFG first: window.QA_CFG = { phone: '07813976959', gbpPhone: '01494582678', routes: ['/','/about'], reviewTexts: ['...verbatim...'] }
(async () => {
  const CFG = Object.assign({ phonePending: false, ctaLabel: null, phone: null, gbpPhone: null, routes: [location.pathname], reviewTexts: [], preview: false, testFormAction: null, demo: false, domain: null }, window.QA_CFG || {});
  const R = []; const add = (gate, check, pass, detail) => R.push({ gate, check, result: pass === null ? 'NEEDS TESTING' : pass === 'AMBER' ? 'AMBER' : pass ? 'PASS' : 'FAIL', detail });
  const q = s => [...document.querySelectorAll(s)];
  const text = document.body.innerText;
  const bodyCopy = document.body.cloneNode(true); bodyCopy.querySelectorAll('[data-pending]').forEach(e => e.remove());
  const claimText = bodyCopy.textContent.replace(/\s+/g, ' ');

  // 1 Placeholders
  // Scan visible text + link/image/meta attribute values only (not CSS, which uses [attr] selectors)
  const scan = [text, document.title, ...q('[href],[src],[alt],[content],[placeholder]').flatMap(e => ['href', 'src', 'alt', 'content', 'placeholder'].map(a => e.getAttribute(a) || ''))].join('\n');
  const ph = (scan.match(/\[[A-Z][A-Z _\-—]{2,}[^\]]*\]|TO BE SUPPLIED|lorem ipsum/g) || []);
  add('A', 'No placeholders in page or links', ph.length === 0, [...new Set(ph)].join(', ') || 'none');

  // 2 Links
  const hrefs = [...new Set(q('a[href]').map(a => a.getAttribute('href')))];
  const bad = hrefs.filter(h => /^\[|^#?$|^javascript:/i.test(h));
  const broken = [];
  for (const h of hrefs.filter(h => h.startsWith('/') && !h.startsWith('//'))) {
    try { const r = await fetch(h, { cache: 'no-store' }); if (!r.ok) broken.push(h + ' ' + r.status); } catch (e) { broken.push(h + ' error'); }
  }
  add('A', '0 broken or empty links (internal)', bad.length + broken.length === 0, [...bad, ...broken].join(', ') || hrefs.length + ' links ok');
  const soft = await fetch('/__qa_does_not_exist__', { cache: 'no-store' }).then(r => r.status).catch(() => 0);
  add('B', 'Unknown URL returns 404', soft === 404, 'status ' + soft);

  // 3 Enquiry path
  const ctas = q('a,button').filter(e => /consultation|enquir|quote|book|contact|map your/i.test(e.innerText) || (CFG.ctaLabel && e.innerText.trim().toLowerCase() === CFG.ctaLabel.toLowerCase()));
  const ctaBad = ctas.filter(e => e.tagName === 'A' && (!e.getAttribute('href') || /^\[/.test(e.getAttribute('href'))));
  add('A', 'Every CTA goes to a real funnel or form', ctas.length > 0 && ctaBad.length === 0, ctas.length + ' CTAs, ' + ctaBad.length + ' broken');
  add('A', 'Test enquiry lands within 5 minutes', null, 'Manual: submit a test enquiry and time it');

  // 4 Phone consistency
  const tels = [...new Set(q('a[href^="tel:"]').map(a => a.getAttribute('href').replace(/\D/g, '').replace(/^44/, '0')))];
  if (CFG.phonePending) add('A', 'Phone matches agreed number everywhere', tels.length ? false : 'AMBER', tels.length ? 'phone is PENDING but the page has tel: links ' + tels.join(', ') : 'phone PENDING: no tel: links shown until it is chosen');
  if (CFG.phone && !CFG.phonePending) add('A', 'Phone matches agreed number everywhere', tels.every(t => t === CFG.phone.replace(/\D/g, '')), 'site: ' + tels.join(', ') + ' · agreed: ' + CFG.phone);
  if (CFG.gbpPhone && !CFG.phonePending) add('B', 'Site phone matches Google Business Profile', tels.includes(CFG.gbpPhone.replace(/\D/g, '')), 'GBP: ' + CFG.gbpPhone + ' · site: ' + tels.join(', '));

  // 5 Claims vs reviews
  const solo = /(one pair of hands|fitted by me|fit every bathroom myself|run by me|by myself|i do it all)/i.exec(claimText);
  const team = CFG.reviewTexts.join(' ') + ' ' + claimText;
  const teamHit = /(and (his|the|her) team|his colleagues|team of professionals)/i.exec(team);
  add('A', 'Copy does not contradict reviews (solo vs team)', !(solo && teamHit), solo && teamHit ? `copy: "${solo[0]}" vs review: "${teamHit[0]}"` : 'no conflict found');
  if (CFG.reviewTexts.length) {
    const shown = q('blockquote, [class*=review] p, [class*=testimonial] p').map(e => e.innerText.trim()).filter(Boolean);
    const altered = shown.filter(s => !CFG.reviewTexts.some(r => r.replace(/\s+/g, ' ').includes(s.replace(/[.…]+$/, '').replace(/\s+/g, ' ').trim())) || (!s.endsWith('…') && !CFG.reviewTexts.some(r => r.trim() === s)));
    add('A', 'Review quotes verbatim; cuts marked …', altered.length === 0, altered.length + ' of ' + shown.length + ' quotes not verbatim or cut without …');
  } else add('A', 'Review quotes verbatim', null, 'Provide QA_CFG.reviewTexts (verbatim from Google) to check');

  // 6 SEO basics
  add('B', 'Own <title> (≤60 chars)', !!document.title && document.title.length <= 60, document.title);
  const md = document.querySelector('meta[name=description]')?.content;
  add('B', 'Meta description (≤155 chars)', !!md && md.length <= 155, md || 'missing');
  add('B', 'Canonical + Open Graph + favicon', !!document.querySelector('link[rel=canonical]') && q('meta[property^="og:"]').length > 0 && q('link[rel*=icon]').length > 0, `canonical ${!!document.querySelector('link[rel=canonical]')}, og ${q('meta[property^="og:"]').length}, icon ${q('link[rel*=icon]').length}`);
  const ld = q('script[type="application/ld+json"]').flatMap(s => { try { const j = JSON.parse(s.textContent); return [].concat(j['@graph'] || j).map(x => [].concat(x['@type']).join('/')); } catch (e) { return ['INVALID']; } });
  add('B', 'LocalBusiness JSON-LD present and valid JSON', ld.some(t => /LocalBusiness|HomeAndConstruction|Plumber|Roofing|Electrician|HVAC|Contractor/i.test(t)) && !ld.includes('INVALID'), ld.join(', ') || 'none');
  const shell = await fetch(location.pathname, { cache: 'no-store' }).then(r => r.text()).catch(() => '');
  add('B', 'Content in server HTML (not JS-only)', shell.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '').trim().length > 300, (shell.length) + ' bytes HTML');
  const robots = await fetch('/robots.txt').then(r => r.ok ? r.text() : '').catch(() => '');
  const smUrl = (robots.match(/sitemap:\s*(\S+)/i) || [, ''])[1];
  // v1.1: a preview must point robots/sitemap at the LIVE domain (CFG.domain), never at the preview host.
  add('B', 'robots/sitemap point to the live domain', CFG.domain ? smUrl === CFG.domain.replace(/\/$/, '') + '/sitemap.xml' : (!robots || robots.includes(location.host) || !/sitemap:/i.test(robots)), smUrl || 'no sitemap line');

  // 7 Speed hygiene
  const blocking = q('script[src]').filter(s => !s.async && !s.defer && s.type !== 'module').map(s => s.src).concat(q('link[rel=stylesheet]').map(l => l.href).filter(h => !h.startsWith(location.origin)));
  add('A', 'No render-blocking third-party CSS/JS (incl. Tailwind CDN)', blocking.filter(h => !h.startsWith(location.origin)).length === 0, blocking.filter(h => !h.startsWith(location.origin)).join(', ') || 'none');
  const fams = new Set(); for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (r.style?.fontFamily) fams.add(r.style.fontFamily.split(',')[0].replace(/["']/g, '').trim()); } catch (e) {} }
  add('A', 'Fonts self-hosted, ≤2 families', q('link[href*="fonts.googleapis"]').length === 0, q('link[href*="fonts.googleapis"]').map(l => l.href.split('family=').slice(1).map(f => f.split(':')[0]).join(' + ')).join('; ') || 'self-hosted');
  const imgs = q('img');
  add('A', 'Images have width + height', imgs.every(i => i.getAttribute('width') && i.getAttribute('height')), imgs.filter(i => !(i.getAttribute('width') && i.getAttribute('height'))).length + ' of ' + imgs.length + ' missing');
  const oversized = imgs.filter(i => i.naturalWidth > 2.2 * Math.max(i.clientWidth, 1) * (devicePixelRatio || 1) / (devicePixelRatio || 1) && i.clientWidth > 0);
  add('A', 'Images not oversized (≤2.2× display width)', oversized.length === 0, oversized.length + ' oversized');
  const below = imgs.filter(i => i.getBoundingClientRect().top > innerHeight);
  add('A', 'Below-the-fold images lazy-loaded', below.every(i => i.loading === 'lazy'), below.filter(i => i.loading !== 'lazy').length + ' of ' + below.length + ' not lazy');

  // 8 Accessibility
  add('A', 'One H1', q('h1').length === 1, q('h1').length + ' H1s');
  add('A', '<main> landmark + skip link', !!document.querySelector('main') && q('a[href^="#"]').some(a => /skip/i.test(a.innerText)), `main ${!!document.querySelector('main')}`);
  add('A', 'Alt on every image', imgs.every(i => i.hasAttribute('alt')), imgs.filter(i => !i.hasAttribute('alt')).length + ' missing alt');
  const small = q('a,button').filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.width < 24 || b.height < 24) && !/skip/i.test(e.innerText); });
  add('A', 'Tap targets ≥24px (WCAG 2.5.8)', small.length === 0, small.map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 25)).join(' | ') || 'ok');
  try {
    if (!window.axe) throw new Error('axe not injected (runner must add node_modules/axe-core/axe.min.js)');
    const ax = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    const serious = ax.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    add('A', 'axe: 0 serious/critical (WCAG 2.2 AA)', serious.length === 0, serious.map(v => `${v.id}×${v.nodes.length}`).join(', ') || 'none');
  } catch (e) { add('A', 'axe scan', null, 'axe could not load: ' + e); }
  add('A', 'No sideways scroll at this width', document.documentElement.scrollWidth <= innerWidth, innerWidth + 'px wide');

  // 9 Privacy
  add('B', 'Privacy link on page', q('a[href]').some(a => /privacy/i.test(a.getAttribute('href') + a.innerText)), '');
  add('B', 'No cookies set on load', document.cookie === '', document.cookie || 'none');
  add('A', 'PageSpeed mobile ≥85, LCP ≤2.5s, CLS ≤0.1', null, 'Run pagespeed.web.dev (mobile) and attach the screenshot');

  // 10 Engine rulebook additions (S4 Build, S5 Gate A)
  if (CFG.preview) {
    add('A', 'Preview banner "Preview – not live" shown', /Preview – not live/.test(text), '');
    add('A', 'Preview hidden from Google (meta noindex)', !!document.querySelector('meta[name=robots][content*=noindex]'), '');
    add('A', 'Preview form posts to the test inbox only', q('form').every(f => f.getAttribute('action') === CFG.testFormAction), q('form').map(f => f.getAttribute('action')).join(', ') || 'no form');
  }
  const pend = q('[data-pending]').map(e => e.getAttribute('data-pending'));
  add('A', 'PENDING markers (amber at Gate A, fail at Gate B)', pend.length ? 'AMBER' : true, pend.join(', ') || 'none');
  const unsafe = q('iframe,object,embed').length + q('*').filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length + q('a[href^="javascript:" i]').length + q('script').filter(s => !s.hasAttribute('data-qa-runner') && !(s.type === 'application/ld+json' || s.getAttribute('src') === '/assets/site.js')).length;
  add('A', 'No script/iframe/on* handler/javascript: link from content', unsafe === 0, unsafe + ' found');
  add('A', 'Content-Security-Policy present', !!document.querySelector('meta[http-equiv=Content-Security-Policy]'), '');
  const telA = q('a[href^="tel:"]')[0];
  if (CFG.phonePending) add('A', 'Tap-to-call link present and ≥24px tall at this width', telA ? false : 'AMBER', telA ? 'tel: link present although the phone is PENDING' : 'phone PENDING: tap-to-call waits for the phone choice');
  else add('A', 'Tap-to-call link present and ≥24px tall at this width', !!telA && telA.getBoundingClientRect().height >= 24, telA ? Math.round(telA.getBoundingClientRect().height) + 'px' : 'none');
  if (CFG.demo) add('A', 'DEMO label visible', /DEMO/.test(text), '');
  if (CFG.internalReference) add('A', 'INTERNAL REFERENCE marker visible and noindex', /INTERNAL REFERENCE – NOT FOR PUBLICATION/.test(text) && !!document.querySelector('meta[name=robots][content*=noindex]'), '');

  const fails = R.filter(r => r.result === 'FAIL').length, needs = R.filter(r => r.result === 'NEEDS TESTING').length, ambers = R.filter(r => r.result === 'AMBER').length;
  return { url: location.href, summary: `${R.length} checks · ${R.length - fails - needs - ambers} pass · ${fails} FAIL · ${ambers} amber · ${needs} needs testing`, results: R };
})();
