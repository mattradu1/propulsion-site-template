// Components and pages. No client fact is written here: everything comes from cfg.
import { h, raw, safeUrl } from './html.mjs';
import { isPending } from './guards-config.mjs';

// Approved neutral lines for client-pending items (engine rulebook S5, r6).
const NEUTRAL = {
  'ICO number': { we: 'Our ICO registration details are being confirmed. Contact us if you need them.', I: 'My ICO registration details are being confirmed. Contact me if you need them.' },
  default: { we: 'Being confirmed. Please contact us for details.', I: 'Being confirmed. Please contact me for details.' },
};
export const neutral = (cfg, item) => (NEUTRAL[item] || NEUTRAL.default)[cfg.voice];
// Text that may be a pending marker: renders the neutral line, tagged for Gate B.
const t = (cfg, v) => (isPending(v) ? h`<span class="pending" data-pending="${v.pending}">${neutral(cfg, v.pending)}</span>` : v);
const plain = (cfg, v) => (isPending(v) ? neutral(cfg, v.pending) : v);
const V = (cfg, we, I) => (cfg.voice === 'I' ? I : we);

export function ctaUrl(cfg, content) {
  const u = new URL(cfg.funnelUrl);
  u.searchParams.set('utm_source', cfg.utm.source);
  u.searchParams.set('utm_medium', cfg.utm.medium);
  u.searchParams.set('utm_campaign', cfg.utm.campaign);
  u.searchParams.set('utm_content', content);
  return u.toString();
}

const cta = (cfg, content, cls = 'btn') => h`<a class="${cls}" href="${safeUrl(ctaUrl(cfg, content))}">Start your enquiry</a>`;
const tel = (cfg, cls = '') => h`<a${cls ? raw(` class="${cls}"`) : ''} href="${safeUrl('tel:' + cfg.phoneE164)}">${cfg.phone}</a>`;

export function jsonLd(cfg) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': cfg.schemaType || 'HomeAndConstructionBusiness',
    '@id': cfg.domain.replace(/\/$/, '') + '/#business',
    name: cfg.businessName,
    legalName: plain(cfg, cfg.legalName),
    telephone: cfg.phoneE164,
    email: cfg.email,
    url: cfg.domain.replace(/\/$/, '') + '/',
    areaServed: cfg.areasServed.map((a) => ({ '@type': 'Place', name: a })),
    sameAs: [cfg.gbpUrl].filter(Boolean),
  };
  if (cfg.addressPublic === true && cfg.address) ld.address = { '@type': 'PostalAddress', ...cfg.address };
  // Escape "<" so client text can never close the script element.
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

function picture(img, imgs, { alt, lazy, cls = '', sizes, hidden }) {
  // imgs: [{url,w,h}] smallest first.
  const a = imgs[0];
  const srcset = imgs.map((i) => `${i.url} ${i.w}w`).join(', ');
  return h`<img${cls ? raw(` class="${cls}"`) : ''} src="${a.url}" srcset="${srcset}" sizes="${sizes}" width="${a.w}" height="${a.h}" alt="${alt}"${raw(lazy ? ' loading="lazy"' : '')} decoding="async"${raw(hidden ? ' hidden' : '')}>`;
}

function heroSection(cfg, imgs) {
  const text = h`<div class="wrap hero-text">
      <h1>${cfg.hero.h1}</h1>
      ${cfg.hero.intro ? h`<p class="lede">${t(cfg, cfg.hero.intro)}</p>` : ''}
      <div class="actions">${cta(cfg, 'hero')}<a class="btn-ghost" href="${safeUrl('tel:' + cfg.phoneE164)}">Call ${cfg.phone}</a></div>
    </div>`;
  const img = cfg.hero.image && imgs[cfg.hero.image.src];
  if ((cfg.hero.kind === 'photo' || cfg.hero.kind === 'vanTeam') && img) {
    const [m, d] = img;
    return h`<section class="hero" aria-labelledby="hero-h">${raw(text.s.replace('<h1>', '<h1 id="hero-h">'))}
    <picture class="hero-media">
      <source media="(min-width: 768px)" srcset="${d.url}" width="${d.w}" height="${d.h}">
      <img src="${m.url}" width="${m.w}" height="${m.h}" alt="${cfg.hero.image.decorative ? '' : cfg.hero.image.alt}" fetchpriority="high" decoding="async">
    </picture>
  </section>`;
  }
  return h`<section class="hero-textonly" aria-labelledby="hero-h">${raw(text.s.replace('<h1>', '<h1 id="hero-h">'))}</section>`;
}

const trustStrip = (cfg) => (cfg.trustStrip?.length
  ? h`<div class="trust-band"><div class="wrap"><ul class="trust" aria-label="${V(cfg, 'About us at a glance', 'About me at a glance')}">${cfg.trustStrip.map((x) => h`<li>${t(cfg, x.text)}</li>`)}</ul></div></div>` : '');

const processSection = (cfg) => h`<section aria-labelledby="process-h"><div class="wrap">
    <h2 id="process-h">How a job runs</h2>
    <ol class="steps">${cfg.process.map((s) => h`<li><h3>${s.title}</h3><p>${t(cfg, s.text)}</p></li>`)}</ol>
  </div></section>`;

function projectCard(cfg, p, imgs, i) {
  const day = imgs[p.day.src];
  const eve = p.evening && imgs[p.evening.src];
  const sizes = '(min-width: 1152px) 544px, (min-width: 768px) 46vw, 92vw';
  return h`<figure class="project"${raw(eve ? ' data-toggle' : '')}>
      <div class="frame">
        ${picture(p.day.src, day, { alt: p.day.decorative ? '' : p.day.alt, lazy: true, cls: 'view-day', sizes })}
        ${eve ? picture(p.evening.src, eve, { alt: p.evening.alt, lazy: true, cls: 'view-evening', sizes, hidden: true }) : ''}
      </div>
      <figcaption>
        <h3>${p.title}</h3>
        <p class="town">${p.town}</p>
        <p>${t(cfg, p.description)}</p>
        ${eve ? h`<button type="button" class="toggle" aria-pressed="false" hidden>Evening view</button>` : ''}
      </figcaption>
    </figure>`;
}

const projectsSection = (cfg, imgs, list, { heading = 'Recent work', link = true } = {}) => (list.length ? h`<section class="alt" aria-labelledby="work-h"><div class="wrap">
    <h2 id="work-h">${heading}</h2>
    <div class="projects">${list.map((p, i) => projectCard(cfg, p, imgs, i))}</div>
    ${link && cfg.pages.work ? h`<p class="actions"><a class="btn-ghost" href="/work/">See all work</a></p>` : ''}
  </div></section>` : '');

function reviewsSection(cfg) {
  if (!cfg.reviews?.length) return ''; // No reviews: no section, nothing invented.
  return h`<section class="alt" aria-labelledby="reviews-h"><div class="wrap">
    <h2 id="reviews-h">What customers say</h2>
    <div class="reviews-list">${cfg.reviews.map((r) => h`<figure class="review">
        <blockquote cite="${safeUrl(r.source)}"><p>${r.text}</p></blockquote>
        <figcaption>${r.author}${r.date ? h`, <time datetime="${r.date}">${fmtDate(r.date)}</time>` : ''} · <a href="${safeUrl(r.source)}">Source</a></figcaption>
      </figure>`)}</div>
    ${cfg.gbpUrl ? h`<div class="reviews-more"><a href="${safeUrl(cfg.gbpUrl)}">See all reviews on Google</a></div>` : ''}
  </div></section>`;
}

const fmtDate = (d) => { const x = new Date(d + 'T12:00:00Z'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };

function ownerSection(cfg, imgs, { full = false, headingLevel = 2 } = {}) {
  const o = cfg.owner;
  if (!o?.name) return '';
  const img = o.photo && o.photoConfirmed === true && imgs[o.photo]?.[0];
  const H = raw(`h${headingLevel}`);
  return h`<section aria-labelledby="owner-h"><div class="wrap owner">
    ${img ? h`<img src="${img.url}" width="${img.w}" height="${img.h}" alt="${o.alt}" loading="lazy" decoding="async">` : ''}
    <div>
      <${H} id="owner-h">Who you'll be dealing with</${H}>
      <p><strong>${o.name}</strong>${o.role ? h`, ${o.role}` : ''}</p>
      <p>${t(cfg, o.bio)}</p>
      ${!full && cfg.pages.about ? h`<p><a class="btn-ghost" href="/about/">About ${V(cfg, 'us', 'me')}</a></p>` : ''}
    </div>
  </div></section>`;
}

const servicesSection = (cfg, { full = false } = {}) => h`<section aria-labelledby="services-h"><div class="wrap">
    <h2 id="services-h">${full ? 'What ' + V(cfg, 'we', 'I') + ' do' : 'Services'}</h2>
    <ul class="services">${cfg.services.map((s) => h`<li><h3>${s.name}</h3><p>${t(cfg, s.description)}</p></li>`)}</ul>
    ${!full && cfg.pages.services ? h`<p class="actions"><a class="btn-ghost" href="/services/">All services</a></p>` : ''}
  </div></section>`;

const areasSection = (cfg, alt = false) => h`<section${raw(alt ? ' class="alt"' : '')} aria-labelledby="areas-h"><div class="wrap">
    <h2 id="areas-h">Areas ${V(cfg, 'we', 'I')} cover</h2>
    <ul class="areas">${cfg.areasServed.map((a) => h`<li>${a}</li>`)}</ul>
  </div></section>`;

const ctaBand = (cfg, where) => h`<section class="cta-band" aria-labelledby="cta-h-${where}"><div class="wrap">
    <h2 id="cta-h-${where}">Tell ${V(cfg, 'us', 'me')} about the job</h2>
    <p>${V(cfg, 'Answer a few short questions and we will get back to you.', 'Answer a few short questions and I will get back to you.')}</p>
    ${cta(cfg, 'band-' + where)}
  </div></section>`;

function enquiryForm(cfg, preview) {
  const action = preview ? cfg.preview.testFormAction : cfg.form?.action;
  if (!action) return '';
  return h`<section class="enquiry" id="enquire" aria-labelledby="enq-h"><div class="wrap">
    <h2 id="enq-h">Or send a message</h2>
    ${preview ? h`<p class="form-note"><strong>This is a preview.</strong> Messages from this form go to a Propulsion test inbox, not to ${cfg.businessName}.</p>` : ''}
    <form method="post" action="${safeUrl(action)}">
      ${preview ? h`<input type="hidden" name="test_id" value="${'preview-' + cfg.slug}">` : ''}
      <div><label for="f-name">Name</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>
      <div><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
      <div><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
      <div><label for="f-msg">About the job</label><textarea id="f-msg" name="message" rows="4"></textarea></div>
      <div><label class="consent"><input type="checkbox" name="consent" value="yes" required> <span>${cfg.form.consentText} See the <a href="/privacy/">privacy notice</a>.</span></label></div>
      <div><button class="btn" type="submit">Send enquiry</button></div>
    </form>
  </div></section>`;
}

function header(cfg, current) {
  const items = [['/', 'Home', true], ['/work/', 'Work', cfg.pages.work], ['/services/', 'Services', cfg.pages.services], ['/about/', 'About', cfg.pages.about], ['/ideas/', 'Ideas', cfg.pages.ideas]].filter((x) => x[2]);
  return h`<header class="site-header"><div class="wrap">
    <a class="brand" href="/">${cfg.businessName}</a>
    <nav class="nav" aria-label="Main"><ul>${items.map(([href, label]) => h`<li><a href="${href}"${raw(href === current ? ' aria-current="page"' : '')}>${label}</a></li>`)}<li><a href="${safeUrl('tel:' + cfg.phoneE164)}">${cfg.phone}</a></li></ul></nav>
  </div></header>`;
}

const footer = (cfg) => h`<footer class="site-footer"><div class="wrap">
    <p class="f-name">${cfg.businessName}</p>
    <ul><li>${tel(cfg)}</li><li><a href="${safeUrl('mailto:' + cfg.email)}">${cfg.email}</a></li></ul>
    <p>${cfg.areasFooterLine}</p>
    <ul><li><a href="/privacy/">Privacy notice</a></li>${cfg.pages.work ? h`<li><a href="/work/">Work</a></li>` : ''}<li><a href="${safeUrl(ctaUrl(cfg, 'footer'))}">Start your enquiry</a></li></ul>
    <p class="legal">${t(cfg, cfg.legalName)} · Company number ${t(cfg, cfg.companyNumber)} · Registered office: ${t(cfg, cfg.privacy.registeredAddress)}</p>
    ${cfg.demo ? h`<p class="demo-flag">DEMO: a fictional business built to test the Propulsion template. Not a real company, phone number, address or reviews.</p>` : ''}
  </div></footer>`;

export function csp(cfg, preview) {
  const formHost = new URL(preview ? cfg.preview.testFormAction : cfg.form?.action || cfg.domain).origin;
  return `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action ${formHost}; base-uri 'none'; object-src 'none'; frame-src 'none'`;
}

function shell(cfg, ctx, { path, title, description, body, preloads = [] }) {
  const canonical = cfg.domain.replace(/\/$/, '') + path;
  const ogImg = ctx.ogImage ? cfg.domain.replace(/\/$/, '') + ctx.ogImage : null;
  return '<!doctype html>\n' + h`<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp(cfg, ctx.preview)}">
<title>${title}</title>
<meta name="description" content="${description}">
${raw(ctx.preview ? '<meta name="robots" content="noindex, nofollow">\n' : '')}<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${cfg.businessName}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
${ogImg ? h`<meta property="og:image" content="${ogImg}">` : ''}
<meta property="og:locale" content="en_GB">
<link rel="icon" href="/favicon.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${ctx.fontPreloads.map((f) => h`<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`)}
${preloads}
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
<script type="application/ld+json">${raw(jsonLd(cfg))}</script>
</head>
<body class="variant-${cfg.variant.toLowerCase()} layout-${cfg.layout.toLowerCase()}${raw(cfg.demo ? ' is-demo' : '')}">
<a class="skip" href="#main">Skip to content</a>
${ctx.preview ? h`<aside class="preview-banner" aria-label="Preview notice"><strong>Preview – not live.</strong> This site is not public yet and is hidden from search engines.</aside>` : ''}
${header(cfg, path)}
<main id="main">
${body}
</main>
${footer(cfg)}
</body>
</html>
`.s;
}

const titleFor = (cfg, page, fallback) => cfg.seo?.[page]?.title || fallback;
const descFor = (cfg, page, fallback) => (cfg.seo?.[page]?.description || fallback).slice(0, 155);

export function renderPages(cfg, imgs, ctx) {
  const pages = {};
  const main = cfg.areasServed[0];
  const featured = cfg.projects.filter((p) => p.featured).slice(0, 3);
  const heroImg = cfg.hero.image && imgs[cfg.hero.image.src];
  const heroPreload = heroImg ? h`<link rel="preload" as="image" href="${heroImg[0].url}" media="(max-width: 767px)" fetchpriority="high">
<link rel="preload" as="image" href="${heroImg[1].url}" media="(min-width: 768px)" fetchpriority="high">` : '';
  const page = (path, title, description, body, preloads) => shell(cfg, ctx, { path, title, description, body, preloads });

  pages['index.html'] = page('/', titleFor(cfg, 'home', `${cfg.trade} in ${main} | ${cfg.businessName}`),
    descFor(cfg, 'home', `${cfg.tradeDescription} across ${cfg.areasServed.slice(0, 4).join(', ')}. ${cfg.businessName}.`),
    h`${heroSection(cfg, imgs)}${trustStrip(cfg)}${processSection(cfg)}${projectsSection(cfg, imgs, featured.length ? featured : cfg.projects.slice(0, 2))}${ownerSection(cfg, imgs)}${servicesSection(cfg)}${reviewsSection(cfg)}${areasSection(cfg)}${ctaBand(cfg, 'home')}${enquiryForm(cfg, ctx.preview)}`,
    heroPreload);

  if (cfg.pages.work) pages['work/index.html'] = page('/work/', titleFor(cfg, 'work', `Work | ${cfg.businessName}`),
    descFor(cfg, 'work', `${cfg.trade} jobs by ${cfg.businessName} in ${cfg.areasServed.slice(0, 3).join(', ')}.`),
    h`<section class="hero-textonly"><div class="wrap"><h1>${V(cfg, 'Our', 'My')} work</h1><p class="lede">${cfg.trade} jobs in ${cfg.areasServed.slice(0, 3).join(', ')}.</p></div></section>${projectsSection(cfg, imgs, cfg.projects, { heading: 'Projects', link: false })}${ctaBand(cfg, 'work')}`);

  if (cfg.pages.services) pages['services/index.html'] = page('/services/', titleFor(cfg, 'services', `Services | ${cfg.businessName}`),
    descFor(cfg, 'services', `${cfg.services.map((s) => s.name).join(', ')} from ${cfg.businessName}.`),
    h`<section class="hero-textonly"><div class="wrap"><h1>${cfg.trade} services</h1><p class="lede">${cfg.tradeDescription} in ${main} and nearby.</p></div></section>${servicesSection(cfg, { full: true })}${areasSection(cfg, true)}${ctaBand(cfg, 'services')}`);

  if (cfg.pages.about) pages['about/index.html'] = page('/about/', titleFor(cfg, 'about', `About | ${cfg.businessName}`),
    descFor(cfg, 'about', `About ${cfg.businessName}, ${cfg.trade.toLowerCase()} in ${main}.`),
    h`<section class="hero-textonly"><div class="wrap"><h1>About ${cfg.businessName}</h1><p class="lede">${cfg.tradeDescription} in ${main} and nearby.</p></div></section>${trustStrip(cfg)}${ownerSection(cfg, imgs, { full: true })}${processSection(cfg)}${reviewsSection(cfg)}${areasSection(cfg)}${ctaBand(cfg, 'about')}`);

  if (cfg.pages.ideas && cfg.ideas?.length) pages['ideas/index.html'] = page('/ideas/', titleFor(cfg, 'ideas', `Ideas | ${cfg.businessName}`),
    descFor(cfg, 'ideas', `Ideas and notes from ${cfg.businessName}.`),
    h`<section class="hero-textonly"><div class="wrap"><h1>Ideas</h1></div></section><section><div class="wrap prose">${cfg.ideas.map((i) => h`<h2>${i.title}</h2><p>${t(cfg, i.text)}</p>`)}</div></section>${ctaBand(cfg, 'ideas')}`);

  const pv = cfg.privacy;
  const W = V(cfg, 'we', 'I'), Us = V(cfg, 'us', 'me'), Our = V(cfg, 'our', 'my');
  pages['privacy/index.html'] = page('/privacy/', `Privacy notice | ${cfg.businessName}`, `How ${cfg.businessName} uses the details you send through this website.`,
    h`<section><div class="wrap prose">
      <h1>Privacy notice</h1>
      <p class="muted">Last updated: <time datetime="${pv.lastUpdated}">${fmtDate(pv.lastUpdated)}</time></p>
      <h2>Who ${W} ${V(cfg, 'are', 'am')}</h2>
      <p>This website is run by ${t(cfg, cfg.legalName)} (company number ${t(cfg, cfg.companyNumber)}), registered office ${t(cfg, pv.registeredAddress)}. Contact: ${tel(cfg)}, <a href="${safeUrl('mailto:' + cfg.email)}">${cfg.email}</a>.</p>
      <h2>ICO registration</h2>
      <p>${isPending(pv.icoNumber) ? t(cfg, pv.icoNumber) : /not registered/i.test(pv.icoNumber) ? `${cfg.businessName} is not registered with the Information Commissioner's Office.` : h`ICO registration number: ${pv.icoNumber}.`}</p>
      <h2>What ${W} collect and why</h2>
      <p>When you send an enquiry ${W} receive the details you type in: usually your name, phone number, email address and a description of the job. ${V(cfg, 'We use', 'I use')} them only to reply to your enquiry and, if you go ahead, to arrange and carry out the work.</p>
      <h2>Who handles your details</h2>
      <p>Enquiry forms are processed by ${t(cfg, pv.formHost)}. Email is provided by ${t(cfg, pv.emailHost)}. ${V(cfg, 'We do', 'I do')} not sell your details or use them for advertising.</p>
      <h2>Cookies</h2>
      <p>This website does not set cookies and does not use tracking analytics.</p>
      <h2>Your rights</h2>
      <p>You can ask ${Us} for a copy of the details ${W} hold about you, or ask ${Us} to correct or delete them, by contacting ${Our} business using the details above. If you are unhappy with how your details are handled you can complain to the Information Commissioner's Office.</p>
      <p><a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a></p>
    </div></section>`);

  pages['404.html'] = page('/404.html', `Page not found | ${cfg.businessName}`, `This page could not be found on the ${cfg.businessName} website.`,
    h`<section><div class="wrap prose"><h1>Page not found</h1><p>The page you were looking for isn't here.</p><p class="actions"><a class="btn-ghost" href="/">Go to the home page</a>${cta(cfg, '404')}</p></div></section>`);
  return pages;
}
