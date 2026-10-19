// Craft theme components and pages (v2). No client fact or sentence is written here:
// visible words come from client.json or from src/lines.mjs (approved lines). Missing → section left out.
import { h, raw, safeUrl } from './html.mjs';
import { isPending, has, ideasShown, heroKind } from './config.mjs';
import { line, neutral, LINES } from './lines.mjs';
import { homeOrder } from './brief.mjs';

export { neutral };
// Pending items: a neutral approved line on previews; on an INTERNAL REFERENCE build the fixed
// marker "PENDING: {item}" so the open conflict is visible (amber at Gate A, fails Gate B either way).
const t = (cfg, v) => (isPending(v) ? h`<span class="pending" data-pending="${v.pending}">${cfg.internalReference === true ? 'PENDING: ' + v.pending : neutral(cfg, v.pending)}</span>` : v);
const plain = (cfg, v) => (isPending(v) ? neutral(cfg, v.pending) : v);
const L = (cfg, k) => t(cfg, line(cfg, k));
const opt = (cfg, k) => cfg.copy?.[k];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const base = (cfg) => cfg.domain.replace(/\/$/, '');
const pendAttr = (img) => (isPending(img?.origin) ? h` data-pending="${img.origin.pending}"` : '');

export function ctaUrl(cfg, content) {
  const u = new URL(cfg.funnelUrl);
  u.searchParams.set('utm_source', cfg.utm.source);
  u.searchParams.set('utm_medium', cfg.utm.medium);
  u.searchParams.set('utm_campaign', cfg.utm.campaign);
  u.searchParams.set('utm_content', content);
  return u.toString();
}
// Funnel first (lowest friction). If the funnel URL is still pending, CTAs go to the consultation page.
const ctaHref = (cfg, content) => (typeof cfg.funnelUrl === 'string' ? ctaUrl(cfg, content) : '/consultation/');
const cta = (cfg, content, cls = 'btn') => h`<a class="${cls}" href="${safeUrl(ctaHref(cfg, content))}">${L(cfg, 'ctaLabel')}</a>`;
const tel = (cfg) => (isPending(cfg.phone) ? t(cfg, cfg.phone) : h`<a href="${safeUrl('tel:' + cfg.phoneE164)}">${cfg.phone}</a>`);
const callLink = (cfg, cls = 'tlink') => (isPending(cfg.phone) ? '' : h`<a class="${cls}" href="${safeUrl('tel:' + cfg.phoneE164)}"><span>${L(cfg, 'call')}</span> <span>${cfg.phone}</span></a>`);
const eyebrow = (cfg, v) => (has(v) ? h`<p class="eyebrow">${t(cfg, v)}</p>` : '');

export function jsonLd(cfg) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': cfg.schemaType || 'HomeAndConstructionBusiness',
    '@id': base(cfg) + '/#business',
    name: cfg.businessName,
    url: base(cfg) + '/',
    email: cfg.email,
    areaServed: cfg.areasServed.map((a) => ({ '@type': 'Place', name: a })),
  };
  if (typeof cfg.legalName === 'string') ld.legalName = cfg.legalName;
  if (typeof cfg.phoneE164 === 'string' && !isPending(cfg.phone)) ld.telephone = cfg.phoneE164;
  if (typeof cfg.gbpUrl === 'string') ld.sameAs = [cfg.gbpUrl];
  if (cfg.addressPublic === true && cfg.address) ld.address = { '@type': 'PostalAddress', ...cfg.address };
  if (cfg.ogImage) ld.image = cfg.ogImage;
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

// Two crops (phone 4:5 or similar, desktop wide) → <picture>. One crop family → srcset.
function artPicture(set, { alt, lazy, priority, img }) {
  const [m, d] = set;
  return h`<picture>${d ? h`<source media="(min-width: 768px)" srcset="${d.url}" width="${d.w}" height="${d.h}">` : ''}<img src="${m.url}" width="${m.w}" height="${m.h}" alt="${alt}"${raw(lazy ? ' loading="lazy"' : '')}${raw(priority ? ' fetchpriority="high"' : '')} decoding="async"${pendAttr(img)}></picture>`;
}
function srcsetImg(set, { alt, lazy, cls, sizes, extra = '', img }) {
  const a = set[0];
  return h`<img${cls ? raw(` class="${cls}"`) : ''} src="${a.url}"${set.length > 1 ? h` srcset="${set.map((i) => `${i.url} ${i.w}w`).join(', ')}" sizes="${sizes}"` : ''} width="${a.w}" height="${a.h}" alt="${alt}"${raw(lazy ? ' loading="lazy"' : '')} decoding="async"${raw(extra)}${pendAttr(img)}>`;
}
const altOf = (im) => (im.decorative ? '' : im.alt);

function hero(cfg, imgs) {
  const H = cfg.hero;
  const img = H.image && imgs[`${H.image.src}|${heroKind(cfg)}`];
  const dark = cfg.variant !== 'B';
  const copy = h`<div class="hero-copy"><div class="wrap">
      ${has(H.tagline) ? h`<p class="tagline">${t(cfg, H.tagline)}</p>` : ''}
      <h1 id="hero-h">${H.h1}</h1>
      <span class="rule" aria-hidden="true"></span>
      ${has(H.intro) ? h`<p class="intro">${t(cfg, H.intro)}</p>` : ''}
      <div class="actions">${cta(cfg, 'hero')}${callLink(cfg)}</div>
    </div></div>`;
  if ((H.kind === 'photo' || H.kind === 'vanTeam') && img)
    return h`<section class="hero has-photo${raw(dark ? ' on-dark' : '')}" aria-labelledby="hero-h">
    <div class="hero-media">${artPicture(img, { alt: altOf(H.image), priority: true, img: H.image })}</div>
    <div class="hero-veil" aria-hidden="true"></div>
    ${copy}
  </section>`;
  return h`<section class="hero text-only${raw(dark ? ' on-dark' : '')}" aria-labelledby="hero-h">${copy}</section>`;
}

const trustStrip = (cfg) => ((cfg.trustStrip || []).length ? h`<div class="trust-band"><div class="wrap"><ul class="trust">${cfg.trustStrip.map((x) => h`<li>${has(x.title) ? h`<p class="t-title">${t(cfg, x.title)}</p>` : ''}${has(x.text) ? h`<p class="${has(x.title) ? 't-text' : 't-title'}">${t(cfg, x.text)}</p>` : ''}</li>`)}</ul></div></div>` : '');

const intro = (cfg) => h`<section class="section intro" aria-labelledby="intro-h"><div class="wrap"><div class="inner rise">
    ${eyebrow(cfg, cfg.intro.eyebrow)}
    <h2 id="intro-h">${t(cfg, cfg.intro.heading)}</h2>
    <div class="divider" aria-hidden="true"></div>
    ${has(cfg.intro.text) ? h`<p>${t(cfg, cfg.intro.text)}</p>` : ''}
  </div></div></section>`;

const PAGE_PATH = { about: '/about/', work: '/work/', consultation: '/consultation/', ideas: '/ideas/', services: '/services/' };
function story(cfg, imgs, s) {
  const i = cfg.stories.indexOf(s);
  const im = s.image && imgs[`${s.image.src}|section`];
  const id = 'story-' + slug(s.id);
  const to = s.link && cfg.pages[s.link.to] && PAGE_PATH[s.link.to];
  return h`<section class="story ${im ? 'has-media' : 'no-media'}${raw(i % 2 ? ' reverse' : '')}" aria-labelledby="${id}">
    ${im ? h`<div class="story-media">${artPicture(im, { alt: altOf(s.image), lazy: true, img: s.image })}</div>` : ''}
    <div class="story-copy"><div class="inner rise">
      ${eyebrow(cfg, s.eyebrow)}
      <h2 id="${id}">${t(cfg, s.heading)}</h2>
      ${has(s.text) ? h`<p>${t(cfg, s.text)}</p>` : ''}
      ${to ? h`<a class="tlink" href="${to}">${t(cfg, s.link.label)}</a>` : ''}
    </div></div>
  </section>`;
}

function pair(cfg, imgs, pr) {
  const k = pr.wide ? 'projectWide' : 'project';
  const day = imgs[`${pr.day.src}|${k}`];
  const eve = pr.evening && imgs[`${pr.evening.src}|${k}`];
  const sizes = pr.wide ? '(min-width: 1440px) 1312px, 92vw' : '(min-width: 1440px) 636px, (min-width: 768px) 46vw, 92vw';
  return h`<figure class="pair${raw(pr.wide ? ' wide' : '')}">${srcsetImg(day, { alt: altOf(pr.day), lazy: true, cls: 'day', sizes, img: pr.day })}${eve ? srcsetImg(eve, { alt: pr.evening.alt, lazy: true, cls: 'eve', sizes, extra: ' aria-hidden="true"', img: pr.evening }) : ''}</figure>`;
}

function workSection(cfg, imgs, projects, { id = 'work', link = false } = {}) {
  const list = projects.filter((p) => p.pairs?.length);
  if (!list.length) return '';
  const anyEve = list.some((p) => p.pairs.some((x) => x.evening));
  return h`<section class="section work" id="${id}" data-mode="day" aria-labelledby="${id}-h"><div class="wrap">
    <div class="sechead rise">
      ${eyebrow(cfg, opt(cfg, 'workEyebrow'))}
      <h2 id="${id}-h">${L(cfg, 'workHeading')}</h2>
      ${has(opt(cfg, 'workNote')) ? h`<p class="note">${t(cfg, opt(cfg, 'workNote'))}</p>` : ''}
      ${anyEve ? h`<div class="lighting" role="group" aria-label="${plain(cfg, line(cfg, 'lightingGroup'))}" hidden><span class="ind" aria-hidden="true"></span><button type="button" data-mode="day" aria-pressed="true">${L(cfg, 'day')}</button><button type="button" data-mode="evening" aria-pressed="false">${L(cfg, 'evening')}</button></div>` : ''}
    </div>
    ${list.map((p) => h`<article class="project">
      <div class="pairs">${p.pairs.map((pr) => pair(cfg, imgs, pr))}</div>
      <div class="project-note rise">
        ${has(p.title) ? h`<h3>${t(cfg, p.title)}</h3>` : ''}
        ${has(p.description) ? h`<p>${t(cfg, p.description)}</p>` : ''}
        ${has(p.town) ? h`<p class="meta">${t(cfg, p.town)}</p>` : ''}
      </div>
    </article>`)}
    ${link && cfg.pages.work ? h`<p class="center"><a class="tlink" href="/work/">${L(cfg, 'seeAllWork')}</a></p>` : ''}
  </div></section>`;
}

function processSection(cfg, imgs) {
  const P = cfg.process;
  const im = P.image && imgs[`${P.image.src}|portrait`];
  return h`<section class="section paper process" aria-labelledby="process-h"><div class="wrap"><div class="process-grid${raw(im ? ' has-media' : '')}">
    ${im ? h`<div class="process-media">${srcsetImg(im, { alt: altOf(P.image), lazy: true, img: P.image, sizes: '(min-width: 768px) 40vw, 92vw' })}</div>` : ''}
    <div class="rise">
      ${eyebrow(cfg, P.eyebrow)}
      <h2 id="process-h">${has(P.heading) ? t(cfg, P.heading) : L(cfg, 'processHeading')}</h2>
      <ol class="steps">${P.steps.map((s) => h`<li><div><h3>${t(cfg, s.title)}</h3><p>${t(cfg, s.text)}</p></div></li>`)}</ol>
    </div>
  </div></div></section>`;
}

function ownerSection(cfg, imgs, { link = true } = {}) {
  const o = cfg.owner;
  if (!o?.name) return '';
  const img = o.photo && o.photoConfirmed === true && imgs[`${o.photo}|portrait`];
  return h`<section class="section" aria-labelledby="owner-h"><div class="wrap"><div class="owner ${img ? 'has-photo' : 'no-photo'}">
    ${img ? srcsetImg(img, { alt: o.alt, lazy: true, sizes: '(min-width: 768px) 40vw, 92vw' }) : ''}
    <div class="rise">
      ${eyebrow(cfg, opt(cfg, 'ownerEyebrow'))}
      <h2 id="owner-h">${L(cfg, 'ownerHeading')}</h2>
      <p class="name">${t(cfg, o.name)}</p>
      ${has(o.role) ? h`<p class="role">${t(cfg, o.role)}</p>` : ''}
      ${has(o.bio) ? h`<p>${t(cfg, o.bio)}</p>` : ''}
      ${link && cfg.pages.about ? h`<a class="tlink" href="/about/">${L(cfg, 'aboutLink')}</a>` : ''}
    </div>
  </div></div></section>`;
}

const fmtDate = (d) => { const x = new Date(d + 'T12:00:00Z'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };

function reviewsSection(cfg, list, { single = false } = {}) {
  if (!list?.length) return ''; // No reviews: no section, nothing invented.
  return h`<section class="section quotes-band"${single ? '' : raw(' aria-labelledby="reviews-h"')}><div class="wrap">
    ${single ? '' : h`<div class="sechead">${eyebrow(cfg, opt(cfg, 'reviewsEyebrow'))}<h2 id="reviews-h">${L(cfg, 'reviewsHeading')}</h2></div>`}
    <div class="quotes n${Math.min(list.length, 3)}${raw(single ? ' single' : '')}">${list.map((r) => h`<figure class="quote rise">
      <span class="mark" aria-hidden="true"></span>
      <blockquote${typeof r.source === 'string' ? h` cite="${safeUrl(r.source)}"` : ''}><p>${r.text}</p></blockquote>
      <figcaption><span>${r.author}</span>${r.date ? h` · <time datetime="${r.date}">${fmtDate(r.date)}</time>` : ''} · ${typeof r.source === 'string' ? h`<a href="${safeUrl(r.source)}">${L(cfg, 'reviewSource')}</a>` : t(cfg, r.source)}</figcaption>
    </figure>`)}</div>
    ${!single && typeof cfg.gbpUrl === 'string' ? h`<p class="more"><a class="tlink" href="${safeUrl(cfg.gbpUrl)}">${L(cfg, 'allReviews')}</a></p>` : ''}
  </div></section>`;
}

const servicesSection = (cfg, { link = true } = {}) => h`<section class="section" aria-labelledby="services-h"><div class="wrap">
    <h2 id="services-h">${L(cfg, 'servicesHeading')}</h2>
    <ul class="services">${cfg.services.map((s) => h`<li><h3>${t(cfg, s.name)}</h3><p>${t(cfg, s.description)}</p></li>`)}</ul>
    ${link && cfg.pages.services ? h`<p><a class="tlink" href="/services/">${L(cfg, 'allServices')}</a></p>` : ''}
  </div></section>`;

const areasSection = (cfg) => h`<section class="section paper" aria-labelledby="areas-h"><div class="wrap center">
    <h2 id="areas-h">${L(cfg, 'areasHeading')}</h2>
    <ul class="areas">${cfg.areasServed.map((a) => h`<li>${a}</li>`)}</ul>
  </div></section>`;

function ctaBand(cfg, imgs, where) {
  const im = cfg.cta?.image && imgs[`${cfg.cta.image.src}|section`];
  return h`<section class="cta-band" aria-labelledby="cta-h-${where}">
    ${im ? h`<div class="bg">${artPicture(im, { alt: '', lazy: true, img: cfg.cta.image })}</div>` : ''}
    <div class="wrap"><div class="inner rise">
      <h2 id="cta-h-${where}">${L(cfg, 'ctaHeading')}</h2>
      <p>${L(cfg, 'ctaText')}</p>
      <div class="actions">${cta(cfg, 'band-' + where)}</div>
    </div></div>
  </section>`;
}

function enquiryForm(cfg, preview) {
  const action = preview ? cfg.preview?.testFormAction : (typeof cfg.form?.action === 'string' ? cfg.form.action : null);
  if (!action) return '';
  return h`<section class="section paper enquiry" id="enquire" aria-labelledby="enq-h"><div class="wrap">
    <h2 id="enq-h" class="center">${L(cfg, 'formHeading')}</h2>
    ${preview ? h`<p class="form-note"><strong>${LINES.formPreviewStrong}</strong> <span>${LINES.formPreviewNote}</span></p>` : ''}
    <form method="post" action="${safeUrl(action)}">
      ${preview ? h`<input type="hidden" name="test_id" value="${'preview-' + cfg.slug}">` : ''}
      <div><label for="f-name">${L(cfg, 'formName')}</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>
      <div><label for="f-phone">${L(cfg, 'formPhone')}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
      <div><label for="f-email">${L(cfg, 'formEmail')}</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
      <div><label for="f-msg">${L(cfg, 'formMessage')}</label><textarea id="f-msg" name="message" rows="4"></textarea></div>
      <div><label class="consent"><input type="checkbox" name="consent" value="yes" required> <span>${t(cfg, cfg.form.consentText)}</span></label> <a href="/privacy/">${L(cfg, 'privacy')}</a></div>
      <div><button class="btn" type="submit">${L(cfg, 'formSend')}</button></div>
    </form>
  </div></section>`;
}

function navItems(cfg) {
  return [['/work/', 'navWork', cfg.pages.work], ['/services/', 'navServices', cfg.pages.services], ['/ideas/', 'navIdeas', cfg.pages.ideas], ['/about/', 'navAbout', cfg.pages.about]].filter((x) => x[2]);
}
const logoImg = (cfg, imgs, lazy = false) => { const l = cfg.brand.logo && imgs[`${cfg.brand.logo.src}|logo`]?.[0]; return l ? h`<img src="${l.url}" width="${Math.round(l.w / 2)}" height="${Math.round(l.h / 2)}" alt=""${raw(lazy ? ' loading="lazy"' : '')}>` : ''; };

function header(cfg, imgs, current) {
  return h`<header class="site-header"><span class="progress" aria-hidden="true"></span><div class="wrap">
    <a class="brand" href="/">${logoImg(cfg, imgs)}<span class="wordmark">${cfg.businessName}</span></a>
    <a class="burger" href="#site-footer">${L(cfg, 'menu')}</a>
    <nav class="nav" id="primary-nav" aria-label="Main"><button type="button" class="nav-close" hidden>${L(cfg, 'close')}</button><ul>${navItems(cfg).map(([href, key]) => h`<li><a href="${href}"${raw(href === current ? ' aria-current="page"' : '')}>${L(cfg, key)}</a></li>`)}<li>${cta(cfg, 'nav')}</li></ul></nav>
  </div></header>`;
}

function footer(cfg, imgs) {
  return h`<footer class="site-footer" id="site-footer"><div class="wrap">
    <div class="f-cols">
      <div><a class="brand" href="/">${logoImg(cfg, imgs, true)}<span class="wordmark">${cfg.businessName}</span></a>${has(opt(cfg, 'footerTagline')) ? h`<p class="f-tag">${t(cfg, opt(cfg, 'footerTagline'))}</p>` : ''}</div>
      <div><h2>${L(cfg, 'explore')}</h2><ul>${navItems(cfg).map(([href, key]) => h`<li><a href="${href}">${L(cfg, key)}</a></li>`)}<li><a href="/privacy/">${L(cfg, 'privacy')}</a></li></ul></div>
      <div><h2>${L(cfg, 'whereWeWork')}</h2><ul>${cfg.areasServed.map((a) => h`<li>${a}</li>`)}</ul></div>
      <div><h2>${L(cfg, 'contact')}</h2><ul><li>${cta(cfg, 'footer', '')}</li><li><a href="${safeUrl('mailto:' + cfg.email)}">${cfg.email}</a></li><li>${tel(cfg)}</li></ul></div>
    </div>
    <div class="footbar">
      <p><span>© ${new Date().getFullYear()}</span> <span>${cfg.businessName}</span></p>
      <p><span>${t(cfg, cfg.legalName)}</span> · <span>${LINES.companyNumber}</span> <span>${t(cfg, cfg.companyNumber)}</span> · <span>${LINES.registeredOffice}</span> <span>${t(cfg, cfg.privacy.registeredAddress)}</span></p>
    </div>
    ${cfg.demo ? h`<p class="flag">${LINES.demoFlag}</p>` : ''}
    ${cfg.internalReference ? h`<p class="flag">${LINES.internalRef}</p><p>${LINES.internalRefNote}</p>` : ''}
  </div></footer>`;
}

export function csp(cfg, preview) {
  const action = preview ? cfg.preview?.testFormAction : (typeof cfg.form?.action === 'string' ? cfg.form.action : null);
  const formHost = action ? new URL(action).origin : "'none'";
  return `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action ${formHost}; base-uri 'none'; object-src 'none'; frame-src 'none'`;
}

export const noindex = (cfg, ctx) => !!(ctx.preview || cfg.internalReference === true);

function shell(cfg, ctx, imgs, { path, title, description, body, preloads = [] }) {
  const canonical = base(cfg) + path;
  const ogImg = ctx.ogImage ? base(cfg) + ctx.ogImage : null;
  return '<!doctype html>\n' + h`<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp(cfg, ctx.preview)}">
<title>${title}</title>
<meta name="description" content="${description}">
${raw(noindex(cfg, ctx) ? '<meta name="robots" content="noindex, nofollow">\n' : '')}<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${cfg.brand.colors.dark}">
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
<script type="application/ld+json">${raw(jsonLd({ ...cfg, ogImage: ogImg }))}</script>
</head>
<body class="theme-${cfg.theme} craft-${cfg.variant.toLowerCase()} layout-${cfg.layout.toLowerCase()}${raw(cfg.demo ? ' is-demo' : '')}">
<a class="skip" href="#main">${LINES.skip}</a>
${ctx.preview ? h`<aside class="preview-banner" aria-label="Preview notice"><strong>${LINES.previewStrong}</strong> <span>${LINES.previewText}</span></aside>` : ''}
${header(cfg, imgs, path)}
<main id="main">
${body}
</main>
${footer(cfg, imgs)}
</body>
</html>
`.s;
}

const titleFor = (cfg, page, fallback) => (typeof cfg.seo?.[page]?.title === 'string' ? cfg.seo[page].title : fallback);
const descFor = (cfg, page, fallback) => String(typeof cfg.seo?.[page]?.description === 'string' ? cfg.seo[page].description : fallback).slice(0, 155);
const pageCopy = (cfg, k) => (typeof cfg.pages[k] === 'object' ? cfg.pages[k] : {});

function pagehead(cfg, imgs, k, h1Key) {
  const pc = pageCopy(cfg, k);
  const im = pc.image && imgs[`${pc.image.src}|section`];
  const h1 = has(pc.h1) ? t(cfg, pc.h1) : L(cfg, h1Key);
  if (!im) return h`<section class="plainhead"><div class="wrap">${eyebrow(cfg, pc.eyebrow)}<h1>${h1}</h1>${has(pc.lede) ? h`<p>${t(cfg, pc.lede)}</p>` : ''}</div></section>`;
  return h`<section class="pagehead has-photo">
    <div class="media">${artPicture(im, { alt: altOf(pc.image), priority: true, img: pc.image })}</div>
    <div class="veil" aria-hidden="true"></div>
    <div class="copy"><div class="wrap">${eyebrow(cfg, pc.eyebrow)}<h1>${h1}</h1>${has(pc.lede) ? h`<p>${t(cfg, pc.lede)}</p>` : ''}</div></div>
  </section>`;
}
const preloadFor = (cfg, imgs, im, kind = 'section') => {
  const set = im && (imgs[`${im.src}|${kind}`]);
  if (!set) return '';
  return set[1]
    ? h`<link rel="preload" as="image" href="${set[0].url}" media="(max-width: 767px)" fetchpriority="high">
<link rel="preload" as="image" href="${set[1].url}" media="(min-width: 768px)" fetchpriority="high">`
    : h`<link rel="preload" as="image" href="${set[0].url}" fetchpriority="high">`;
};
const pickReviews = (cfg, ids) => (Array.isArray(ids) ? ids.map((id) => cfg.reviews.find((r) => r.id === id)).filter(Boolean) : []);

export function renderPages(cfg, imgs, ctx) {
  const pages = {};
  const main = cfg.areasServed[0];
  const page = (path, title, description, body, preloads) => shell(cfg, ctx, imgs, { path, title, description, body, preloads });
  const featured = cfg.projects.filter((p) => p.featured).slice(0, 2);

  const SECTIONS = {
    intro: () => intro(cfg),
    work: () => workSection(cfg, imgs, featured.length ? featured : cfg.projects.slice(0, 1), { link: true }),
    process: () => processSection(cfg, imgs),
    owner: () => ownerSection(cfg, imgs),
    services: () => servicesSection(cfg),
    reviews: () => reviewsSection(cfg, cfg.reviews.slice(0, 3)),
    areas: () => areasSection(cfg),
  };
  const order = homeOrder(cfg);
  const sections = order.map((k) => (k.startsWith('story:') ? story(cfg, imgs, cfg.stories.find((s) => 'story:' + s.id === k)) : SECTIONS[k]()));
  pages['index.html'] = page('/', titleFor(cfg, 'home', `${cfg.trade} in ${main} | ${cfg.businessName}`),
    descFor(cfg, 'home', `${cfg.tradeDescription} across ${cfg.areasServed.slice(0, 4).join(', ')}. ${cfg.businessName}.`),
    h`${hero(cfg, imgs)}${trustStrip(cfg)}${sections}${ctaBand(cfg, imgs, 'home')}`,
    preloadFor(cfg, imgs, cfg.hero.image, heroKind(cfg)));

  if (cfg.pages.work) {
    const pc = pageCopy(cfg, 'work');
    pages['work/index.html'] = page('/work/', titleFor(cfg, 'work', `Work | ${cfg.businessName}`),
      descFor(cfg, 'work', `${cfg.trade} by ${cfg.businessName} in ${cfg.areasServed.slice(0, 3).join(', ')}.`),
      h`${pagehead(cfg, imgs, 'work', 'navWork')}${workSection(cfg, imgs, cfg.projects, { id: 'projects' })}${reviewsSection(cfg, pickReviews(cfg, pc.reviewIds), { single: (pc.reviewIds || []).length === 1 })}${ctaBand(cfg, imgs, 'work')}`,
      preloadFor(cfg, imgs, pc.image));
  }

  if (cfg.pages.services) {
    const pc = pageCopy(cfg, 'services');
    pages['services/index.html'] = page('/services/', titleFor(cfg, 'services', `Services | ${cfg.businessName}`),
      descFor(cfg, 'services', `${cfg.services.map((s) => (typeof s.name === 'string' ? s.name : '')).join(', ')} from ${cfg.businessName}.`),
      h`${pagehead(cfg, imgs, 'services', 'servicesH1')}${servicesSection(cfg, { link: false })}${areasSection(cfg)}${ctaBand(cfg, imgs, 'services')}`,
      preloadFor(cfg, imgs, pc.image));
  }

  if (cfg.pages.about) {
    const pc = pageCopy(cfg, 'about');
    const prose = (pc.sections || []).length ? h`<section class="section"><div class="wrap"><div class="prose rise">${pc.sections.map((s) => h`<h2>${t(cfg, s.heading)}</h2>${(Array.isArray(s.text) ? s.text : [s.text]).map((x) => h`<p>${t(cfg, x)}</p>`)}`)}</div></div></section>` : '';
    const rv = Array.isArray(pc.reviewIds) ? pickReviews(cfg, pc.reviewIds) : cfg.reviews.slice(0, 3);
    pages['about/index.html'] = page('/about/', titleFor(cfg, 'about', `About | ${cfg.businessName}`),
      descFor(cfg, 'about', `About ${cfg.businessName}, ${String(cfg.trade).toLowerCase()} in ${main}.`),
      h`${pagehead(cfg, imgs, 'about', 'aboutH1')}${trustStrip(cfg)}${prose}${ownerSection(cfg, imgs, { link: false })}${reviewsSection(cfg, rv, { single: rv.length === 1 })}${areasSection(cfg)}${ctaBand(cfg, imgs, 'about')}`,
      preloadFor(cfg, imgs, pc.image));
  }

  if (cfg.pages.ideas) {
    const pc = pageCopy(cfg, 'ideas');
    const shown = ideasShown(cfg);
    pages['ideas/index.html'] = page('/ideas/', titleFor(cfg, 'ideas', `Ideas | ${cfg.businessName}`),
      descFor(cfg, 'ideas', `Ideas from ${cfg.businessName}.`),
      h`<section class="plainhead"><div class="wrap">${eyebrow(cfg, pc.eyebrow)}<h1>${has(pc.h1) ? t(cfg, pc.h1) : L(cfg, 'ideasH1')}</h1>
        ${has(pc.intro) ? h`<p>${t(cfg, pc.intro)}</p>` : ''}
        ${shown.length && has(pc.disclaimer) ? h`<p class="disclaimer">${t(cfg, pc.disclaimer)}</p>` : ''}
        ${has(pc.workLink) && cfg.pages.work ? h`<p><a class="tlink" href="/work/">${t(cfg, pc.workLink)}</a></p>` : ''}
      </div></section>
      ${shown.length ? h`<section class="section"><div class="masonry">${shown.map((im) => {
        const set = imgs[`${im.src}|thumb`];
        return set ? h`<figure class="supplier">${srcsetImg(set, { alt: im.alt, lazy: true, sizes: '(min-width: 1000px) 33vw, (min-width: 600px) 50vw, 100vw' })}<figcaption><span>${LINES.supplierImage}</span>${typeof im.supplier === 'string' ? h` · <span>${im.supplier}</span>` : ''}</figcaption></figure>` : '';
      })}</div></section>` : ''}
      ${ctaBand(cfg, imgs, 'ideas')}`);
  }

  if (cfg.pages.consultation) {
    const pc = pageCopy(cfg, 'consultation');
    const reassure = (pc.reassurance || []).length ? h`<ul class="reassure">${pc.reassurance.map((r) => h`<li><h2 class="h-small">${t(cfg, r.title)}</h2>${has(r.text) ? h`<p>${t(cfg, r.text)}</p>` : ''}</li>`)}</ul>` : '';
    pages['consultation/index.html'] = page('/consultation/', titleFor(cfg, 'consultation', `${plain(cfg, line(cfg, 'ctaLabel'))} | ${cfg.businessName}`),
      descFor(cfg, 'consultation', `${plain(cfg, line(cfg, 'ctaLabel'))} with ${cfg.businessName}.`),
      h`<section class="plainhead"><div class="wrap">${eyebrow(cfg, pc.eyebrow)}<h1>${has(pc.h1) ? t(cfg, pc.h1) : L(cfg, 'ctaLabel')}</h1>${has(pc.intro) ? h`<p>${t(cfg, pc.intro)}</p>` : ''}</div></section>
      <section class="section"><div class="wrap">
        <div class="consult-actions">${typeof cfg.funnelUrl === 'string' ? h`<a class="btn" href="${safeUrl(ctaUrl(cfg, 'consultation'))}">${L(cfg, 'ctaLabel')}</a>` : h`<p>${t(cfg, cfg.funnelUrl)}</p>`}${callLink(cfg)}</div>
        ${reassure}
      </div></section>
      ${enquiryForm(cfg, ctx.preview)}`);
  }

  const pv = cfg.privacy;
  const V = (we, I) => (cfg.voice === 'I' ? I : we);
  const W = V('we', 'I'), Us = V('us', 'me'), Our = V('our', 'my');
  pages['privacy/index.html'] = page('/privacy/', `Privacy notice | ${cfg.businessName}`, `How ${cfg.businessName} uses the details you send through this website.`,
    h`<section class="section"><div class="wrap prose"><!--approved:privacy-v2-->
      <h1>${LINES.privacy}</h1>
      <p class="lede">Last updated: <time datetime="${pv.lastUpdated}">${fmtDate(pv.lastUpdated)}</time></p>
      <h2>Who ${W} ${V('are', 'am')}</h2>
      <p>This website is run by ${t(cfg, cfg.legalName)} (company number ${t(cfg, cfg.companyNumber)}), registered office ${t(cfg, pv.registeredAddress)}. Contact: ${tel(cfg)}, <a href="${safeUrl('mailto:' + cfg.email)}">${cfg.email}</a>.</p>
      <h2>ICO registration</h2>
      <p>${isPending(pv.icoNumber) ? t(cfg, pv.icoNumber) : /not registered/i.test(pv.icoNumber) ? `${cfg.businessName} is not registered with the Information Commissioner's Office.` : h`ICO registration number: ${pv.icoNumber}.`}</p>
      <h2>What ${W} collect and why</h2>
      <p>When you send an enquiry ${W} receive the details you type in: usually your name, phone number, email address and a description of the job. ${V('We use', 'I use')} them only to reply to your enquiry and, if you go ahead, to arrange and carry out the work.</p>
      <h2>Who handles your details</h2>
      <p>Enquiry forms are processed by ${t(cfg, pv.formHost)}. Email is provided by ${t(cfg, pv.emailHost)}. ${V('We do', 'I do')} not sell your details or use them for advertising.</p>
      <h2>Cookies</h2>
      <p>This website does not set cookies and does not use tracking analytics. Its typefaces are served from this website, not from Google or any other third party.</p>
      <h2>Your rights</h2>
      <p>You can ask ${Us} for a copy of the details ${W} hold about you, or ask ${Us} to correct or delete them, by contacting ${Our} business using the details above. If you are unhappy with how your details are handled you can complain to the Information Commissioner's Office.</p>
      <p><a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a></p>
    <!--/approved--></div></section>`);

  pages['404.html'] = page('/404.html', `Page not found | ${cfg.businessName}`, `This page could not be found on the ${cfg.businessName} website.`,
    h`<section class="section"><div class="wrap prose"><h1>${LINES.notFoundH1}</h1><p>${LINES.notFoundText}</p><div class="actions"><a class="tlink" href="/">${LINES.goHome}</a>${cta(cfg, '404')}</div></div></section>`);
  return pages;
}
