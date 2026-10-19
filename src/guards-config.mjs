// Checks on client.json before anything is rendered (v2).
// Each problem: { guard, level: 'fail' | 'amber', msg } with a plain-English message.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pairsFor } from './contrast.mjs';
import { approvedSet, findClaims } from './claims.mjs';
import { isPending, has, walk, normalize, imageRefs, IDEAS_MAX } from './config.mjs';
import { checkBrief } from './brief.mjs';
import { COLOR_KEYS, FONT_FILES } from '../themes/craft/tokens.mjs';

export { isPending, walk, imageRefs };
const digits = (s) => String(typeof s === 'string' ? s : '').replace(/\D/g, '').replace(/^44/, '0');
export const PREVIEW_HOSTS = /(\.vercel\.app|\.netlify\.app|\.pages\.dev|\.github\.io|sitedrop|localhost|127\.0\.0\.1|ngrok|share\.google)/i;
const URL_FIELDS = ['gbpUrl', 'reviewUrl', 'funnelUrl', 'domain'];
const stem = (w) => String(w).toLowerCase().trim().replace(/(ing|ers|er|s)$/, '');

export function loadOthers(selfSlug, root, extraDir) {
  const files = [];
  const clientsDir = path.join(root, 'clients');
  if (fs.existsSync(clientsDir))
    for (const d of fs.readdirSync(clientsDir)) {
      const f = path.join(clientsDir, d, 'client.json');
      if (d !== selfSlug && fs.existsSync(f)) files.push(f);
    }
  if (extraDir && fs.existsSync(extraDir))
    for (const f of fs.readdirSync(extraDir)) if (f.endsWith('.json')) files.push(path.join(extraDir, f));
  return files.map((f) => {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    const imgDir = path.join(path.dirname(f), 'images');
    const hashes = new Set();
    if (fs.existsSync(imgDir) && path.basename(path.dirname(path.dirname(f))) === 'clients')
      for (const i of fs.readdirSync(imgDir)) hashes.add(crypto.createHash('sha256').update(fs.readFileSync(path.join(imgDir, i))).digest('hex'));
    return { file: f, cfg: c, hashes };
  }).filter((o) => o.cfg.slug !== selfSlug);
}

// H1 says what and where: the trade and one of the areas (Darren's "Beautifully Considered. Expertly Installed." said neither).
export function h1Problems(cfg, h1) {
  const text = String(h1 || '').toLowerCase();
  const words = text.split(/[^a-z]+/).filter(Boolean).map(stem);
  const tradeWords = [cfg.trade, ...(cfg.tradeKeywords || [])].filter((x) => typeof x === 'string').flatMap((x) => x.split(/\s+/)).map(stem).filter((w) => w.length > 2);
  const out = [];
  if (!tradeWords.some((w) => words.includes(w))) out.push(`does not name the trade (${[cfg.trade, ...(cfg.tradeKeywords || [])].join(' / ')})`);
  const areas = [...(cfg.areasServed || []), cfg.region].filter((a) => typeof a === 'string');
  if (!areas.some((a) => text.includes(a.toLowerCase()))) out.push(`does not name an area (${areas.join(', ')})`);
  return out;
}

export function checkConfig(raw, { clientDir, strict, preview, others = [] }) {
  const out = [];
  const fail = (guard, msg) => out.push({ guard, level: 'fail', msg });
  const amber = (guard, msg) => out.push({ guard, level: 'amber', msg });
  const cfg = normalize(raw);

  // Basics
  for (const k of ['slug', 'businessName', 'legalName', 'companyNumber', 'phone', 'email', 'trade', 'domain', 'tradeDescription'])
    if (!has(cfg[k])) fail('Config', `"${k}" is missing in client.json. Every client fact must come from the config (or { "pending": "…" } while it is confirmed).`);
  if (!isPending(cfg.phone) && !has(cfg.phoneE164)) fail('Config', '"phoneE164" is missing (the tap-to-call number).');
  for (const k of ['businessName', 'email', 'domain', 'trade', 'slug']) if (isPending(cfg[k])) fail('Config', `"${k}" cannot be pending: the site cannot be built around it.`);
  if (cfg.theme !== 'craft') fail('Config', `theme "${cfg.theme}" does not exist. v2 has one theme: "craft".`);
  if (!['I', 'we'].includes(cfg.voice)) fail('Config', `"voice" must be "I" or "we" (found ${JSON.stringify(cfg.voice)}).`);
  if (!Array.isArray(cfg.areasServed) || !cfg.areasServed.length) fail('Config', '"areasServed" needs at least one town.');
  if (cfg.process && !isPending(cfg.process) && (!Array.isArray(cfg.process.steps) || cfg.process.steps.length < 3 || cfg.process.steps.length > 5))
    fail('Config', `"process.steps" needs 3 to 5 steps (found ${cfg.process.steps?.length ?? 0}). Leave "process" out entirely if the client hasn't described it.`);
  if (typeof cfg.phone === 'string' && cfg.phoneE164 && digits(cfg.phoneE164) !== digits(cfg.phone)) fail('Config', `"phoneE164" (${cfg.phoneE164}) does not dial the display number "${cfg.phone}". Tap-to-call would ring the wrong number.`);
  for (const k of ['gbpUrl', 'reviewUrl']) if (typeof cfg[k] === 'string' && /share\.google|goo\.gl|g\.page/i.test(cfg[k])) fail('Config', `"${k}" is a short share link (${cfg[k]}). Use the full Google Business Profile URL.`);

  // H1: trade + area
  if (!has(cfg.hero?.h1) || isPending(cfg.hero?.h1)) fail('H1 what/where', 'hero.h1 is missing. The home page H1 must say the trade and the area, in approved client words.');
  else { const p = h1Problems(cfg, cfg.hero.h1); if (p.length) fail('H1 what/where', `hero.h1 "${cfg.hero.h1}" ${p.join(' and ')}. Use the client's approved line that says what and where; keep a strapline in hero.tagline.`); }

  // G2 alt text
  for (const r of imageRefs(cfg)) {
    if (r.decorative === true) continue;
    if (typeof r.alt !== 'string' || !r.alt.trim()) fail('G2 Alt text', `The image "${r.src}" at ${r.where} has no alt text. Add "alt" in client.json, or mark it "decorative": true if it carries no information.`);
  }

  // G3 contrast (every pair the craft theme paints)
  const c = cfg.brand?.colors || {};
  const missing = COLOR_KEYS.filter((k) => !c[k]);
  if (missing.length) fail('G3 Contrast', `brand.colors is missing: ${missing.join(', ')} (craft theme roles: ${COLOR_KEYS.join(', ')}).`);
  else {
    try {
      for (const p of pairsFor(c, cfg.variant))
        if (!p.ok) fail('G3 Contrast', `Colour pair ${p.fg} ${c[p.fg]} on ${p.bg} ${p.bgValue} (${p.where}) is ${p.ratio}:1. It needs at least ${p.min}:1. Darken or lighten one of them.`);
    } catch (e) { fail('G3 Contrast', `brand.colors: ${e.message}.`); }
  }
  // G9 fonts: max 2 families, self-hosted files only
  const fonts = cfg.brand?.fonts || {};
  const fam = new Set(Object.values(fonts));
  if (!fonts.display || !fonts.text) fail('G9 Third-party assets', 'brand.fonts needs "display" and "text" families (they may be the same family).');
  if (fam.size > 2) fail('G9 Third-party assets', `brand.fonts lists ${fam.size} families; the limit is 2.`);
  for (const f of fam) if (!FONT_FILES[f] && !cfg.brand?.fontFiles?.[f]) fail('G9 Third-party assets', `Font "${f}" has no self-hosted files. Use ${Object.keys(FONT_FILES).join(', ')}, or add brand.fontFiles["${f}"] with .woff2 files in clients/${cfg.slug}/fonts/.`);
  if (cfg.brand?.fontCssUrl) fail('G9 Third-party assets', `brand.fontCssUrl loads CSS from "${cfg.brand.fontCssUrl}". Fonts and CSS must be self-hosted: put the .woff2 files in clients/${cfg.slug}/fonts/ and list them in brand.fontFiles.`);
  // Restraint tokens: corners and shadows only via brand tokens, and only plain CSS lengths/none.
  if (cfg.brand?.radius != null && !/^(0|[0-9]{1,2}px)$/.test(String(cfg.brand.radius))) fail('Restraint tokens', `brand.radius "${cfg.brand.radius}" must be 0 or a small px value like "2px".`);
  if (cfg.brand?.shadow != null && cfg.brand.shadow !== 'none' && !/^[0-9a-z .,()#%-]{1,80}$/i.test(String(cfg.brand.shadow))) fail('Restraint tokens', 'brand.shadow must be "none" or a plain box-shadow value.');

  // G4 privacy
  for (const k of ['registeredAddress', 'icoNumber', 'lastUpdated', 'formHost', 'emailHost']) {
    const v = cfg.privacy?.[k];
    if (isPending(v)) continue; // reported by R4
    if (v == null || (typeof v === 'string' && !v.trim())) fail('G4 Privacy', `privacy.${k} is empty. The privacy page cannot be built without it.${k === 'icoNumber' ? ' Use the ICO number, "not registered", or { "pending": "ICO number" } while the client checks.' : ''}`);
  }

  // G5 funnel
  if (isPending(cfg.funnelUrl)) { if (!cfg.pages.consultation) fail('G5 Funnel URL', 'funnelUrl is pending and the consultation page is off, so CTAs would have nowhere to go.'); }
  else if (!cfg.funnelUrl) fail('G5 Funnel URL', 'funnelUrl is missing. Every CTA needs somewhere to go.');
  else if (!/^https:\/\/[^\s/[\]{}]+\.[^\s/[\]{}]+/i.test(cfg.funnelUrl) || /[[\]{}]/.test(cfg.funnelUrl)) fail('G5 Funnel URL', `funnelUrl "${cfg.funnelUrl}" is not a real https:// address.`);
  if (!cfg.utm?.source || !cfg.utm?.medium || !cfg.utm?.campaign) fail('G5 Funnel URL', 'utm needs source, medium and campaign so every CTA is tracked.');

  // G6 phone vs Google Business Profile
  if (!isPending(cfg.phone) && !isPending(cfg.gbpPhone) && digits(cfg.phone) !== digits(cfg.gbpPhone)) {
    if (cfg.phoneMismatchApproved && String(cfg.phoneMismatchApproved).trim()) amber('G6 Phone match', `Site phone ${cfg.phone} differs from GBP ${cfg.gbpPhone}; approved: "${cfg.phoneMismatchApproved}".`);
    else fail('G6 Phone match', `The site phone "${cfg.phone}" does not match the Google Business Profile phone "${cfg.gbpPhone ?? '(missing)'}". Fix one of them, or add "phoneMismatchApproved": "<reason>".`);
  }

  // G10 reviews
  cfg.reviews.forEach((r, i) => {
    const txt = String(r.text || '').trimEnd();
    if (r.truncated === true && !txt.endsWith('…'))
      fail('G10 Review cuts', `Review ${i + 1} by ${r.author} is marked truncated but its text does not end in "…". Mark every cut with "…".`);
    if (r.truncated !== true && txt.endsWith('…')) fail('G10 Review cuts', `Review ${i + 1} by ${r.author} ends in "…" but is not marked "truncated": true.`);
    if (isPending(r.source)) { /* R4 */ } else if (!r.source || !/^https:\/\//.test(r.source)) fail('G10 Review cuts', `Review ${i + 1} by ${r.author} has no https source URL. Every review links to where it came from.`);
    if (!r.text || !r.author) fail('G10 Review cuts', `Review ${i + 1} needs both "text" (word for word) and "author".`);
  });
  const ids = cfg.reviews.map((r) => r.id);
  if (new Set(ids).size !== ids.length) fail('G10 Review cuts', 'Two reviews share the same "id".');

  // G11 owner photo
  if (cfg.owner?.photo && cfg.owner.photoConfirmed !== true)
    fail('G11 Owner photo', `owner.photo is set to "${cfg.owner.photo}" but photoConfirmed is not true. Only use the owner's photo once they have confirmed it in writing; otherwise remove "photo".`);

  // G12 domain: canonicals, sitemap and robots are built from it, so it must be the final domain.
  if (typeof cfg.domain === 'string' && (!/^https:\/\/[^/\s]+$/i.test(cfg.domain.replace(/\/$/, '')) || PREVIEW_HOSTS.test(cfg.domain)))
    fail('G12 Sitemap/robots domain', `domain "${cfg.domain}" must be the final live https domain (no path, never a preview host like *.vercel.app or SiteDrop). Canonicals, sitemap.xml and robots.txt are built from it.`);

  // Images: exist, real files, layout eligibility
  const refs = imageRefs(cfg);
  for (const r of refs) {
    const f = path.join(clientDir, 'images', r.src || '');
    if (!r.src || !fs.existsSync(f)) { fail('Images', `Image file "${r.src}" (${r.where}) is not in clients/${cfg.slug}/images/.`); continue; }
    if (!/\.(jpe?g|png|webp)$/i.test(r.src)) fail('Images', `"${r.src}" must be a JPG, PNG or WebP. SVG, HTML and other files are quarantined, never built.`);
  }
  const own = refs.filter((r) => r.own && !r.where.startsWith('owner') && r.kind !== 'logo');
  const usable = new Set(own.map((r) => r.src)).size;
  const finished = cfg.projects.some((p) => p.finished === true && p.pairs?.length);
  if (!['standard', 'lowPhoto'].includes(cfg.layout)) fail('R6 Layout', `layout must be "standard" or "lowPhoto" (found ${JSON.stringify(cfg.layout)}).`);
  if (cfg.layout === 'standard' && (usable < 8 || !finished))
    fail('R6 Layout', `layout "standard" needs 8 or more usable photos of the client's own work including a finished job (found ${usable}${finished ? '' : ', none marked finished'}). Use "lowPhoto".`);
  // Rulebook S2: 3–7 usable → low-photo; a text or van/team hero only when no photo shows a finished job.
  if (cfg.layout === 'lowPhoto' && !['text', 'vanTeam', 'photo'].includes(cfg.hero?.kind))
    fail('R6 Layout', 'layout "lowPhoto" needs hero.kind "text", "vanTeam" (a supplied van/team photo) or "photo" (a finished job).');
  if (cfg.layout === 'lowPhoto' && cfg.hero?.kind === 'photo' && !finished)
    fail('R6 Layout', 'layout "lowPhoto" with a photo hero needs a finished job on file. With no finished-job photo, use hero.kind "text" or "vanTeam".');
  if (cfg.layout === 'standard' && (cfg.hero?.kind !== 'photo' || !cfg.hero?.image)) fail('R6 Layout', 'layout "standard" needs hero.kind "photo" with hero.image (the best finished room).');

  // Process image must show planning or setting out, not another finished room.
  if (cfg.process?.image && !['planning', 'settingOut'].includes(cfg.process.image.shows))
    fail('Process image', `process.image "${cfg.process.image.src}" must show planning or setting out ("shows": "planning" | "settingOut"). A finished room belongs in the work section; leave the process image out until the client sends one.`);

  // Ideas page: supplier images, labelled, 12 max, written permission
  const ideas = cfg.pages.ideas;
  const ideasImgs = (ideas && ideas.images) || [];
  if (ideasImgs.length > IDEAS_MAX) fail('Ideas page', `pages.ideas.images lists ${ideasImgs.length} supplier images; the limit is ${IDEAS_MAX} (lazy-loaded). Pick the best ${IDEAS_MAX}.`);
  if (ideasImgs.length) {
    const perm = cfg.supplierImagesPermission;
    if (perm !== true && !isPending(perm)) amber('Ideas page', 'Supplier images are listed but supplierImagesPermission is not true, so none are shown. Get written permission first.');
    if (!has(ideas.disclaimer)) fail('Ideas page', 'pages.ideas.disclaimer is missing. Supplier images must be labelled as not the client\'s own work, in the client\'s words.');
    if (isPending(perm) && cfg.internalReference !== true) amber('Ideas page', 'supplierImagesPermission is pending, so supplier images are left out of this build.');
  }

  // Funnel pending needs the consultation page; consultation reassurance etc. come from config only.
  // Story links must point at a page that exists.
  cfg.stories.forEach((s, i) => {
    if (!has(s.heading)) fail('Config', `stories[${i}] has no heading.`);
    if (s.link && !['about', 'work', 'consultation', 'ideas', 'services'].includes(s.link.to)) fail('G13 Routing', `stories[${i}].link.to "${s.link.to}" is not a page (about, work, consultation, ideas, services).`);
    else if (s.link && !cfg.pages[s.link.to]) fail('G13 Routing', `stories[${i}] links to the ${s.link.to} page, which is switched off.`);
  });
  for (const [i, r] of (cfg.redirects || []).entries()) {
    if (!/^\/[^\s]*$/.test(r.from || '') || !/^\/[^\s]*$/.test(r.to || '')) fail('G13 Routing', `redirects[${i}] needs "from" and "to" as site paths starting with "/".`);
  }

  // R7 variant
  if (!['A', 'B', 'C'].includes(cfg.variant)) fail('R7 Variant', `variant must be "A", "B" or "C" (found ${JSON.stringify(cfg.variant)}).`);
  for (const o of others) {
    const sameTrade = String(o.cfg.trade || '').toLowerCase() === String(cfg.trade || '').toLowerCase();
    const shared = (o.cfg.areasServed || []).filter((a) => (cfg.areasServed || []).map((x) => x.toLowerCase()).includes(String(a).toLowerCase()));
    if (sameTrade && shared.length && o.cfg.variant === cfg.variant)
      fail('R7 Variant', `${o.cfg.businessName} is also ${cfg.trade} in ${shared.join(', ')} and already uses variant ${cfg.variant}. Pick a different variant so the two sites don't look the same.`);
  }

  // R1 unsafe content in config
  walk(cfg, (s, p, pending) => {
    const v = pending ? s.pending : s;
    if (/<\s*\/?\s*(script|iframe|object|embed|svg|style|link|meta|form)\b/i.test(v)) fail('R1 Unsafe content', `${p} contains an HTML tag (${v.slice(0, 60)}). Client text is plain text only.`);
    if (/\bon[a-z]+\s*=/i.test(v) && /[<"'=]/.test(v)) fail('R1 Unsafe content', `${p} contains what looks like an event handler (${v.slice(0, 60)}).`);
    if (/javascript\s*:|data\s*:\s*text\/html|vbscript\s*:/i.test(v)) fail('R1 Unsafe content', `${p} contains a script link (${v.slice(0, 60)}).`);
  });
  for (const k of URL_FIELDS) if (typeof cfg[k] === 'string' && !/^https:\/\//i.test(cfg[k])) fail('R1 Unsafe content', `${k} must start with https:// (found "${cfg[k]}").`);
  if (typeof cfg.form?.action === 'string' && !/^https:\/\//.test(cfg.form.action)) fail('R1 Unsafe content', 'form.action must be https://.');

  // R3 banned claims (config text; output text is scanned again after render)
  const approved = approvedSet(cfg);
  (cfg.approvedClaims || []).forEach((c, i) => { if (!c?.proof || String(c.proof).trim().length < 5) fail('R3 Banned claims', `approvedClaims[${i}] ("${c?.phrase}") has no "proof" note. A claim is only approved with proof on file.`); });
  walk(cfg, (s, p, pending) => {
    if (pending || /^(approvedClaims|brief|trustStrip\[\d+\]\.source|.*Url$|domain|.*\.src$|reviews\[\d+\]\.source)/.test(p)) return;
    for (const b of findClaims(s, approved)) fail('R3 Banned claims', `${p} uses "${b.phrase}" ("${s.slice(0, 70)}"). Remove it, or add it to approvedClaims with a proof note Matt has checked.`);
  });

  // Brand brief and copy-phrase list
  checkBrief(cfg, fail, amber);
  const cfgStrings = [];
  walk(cfg, (s, p, pending) => { if (!pending && !/^(copyPhrases|brief|seo)/.test(p)) cfgStrings.push(s); });
  (cfg.copyPhrases || []).forEach((cp, i) => {
    const phrase = typeof cp === 'string' ? cp : cp?.phrase;
    if (!phrase) fail('Copy phrases', `copyPhrases[${i}] is empty.`);
    else if (!cfgStrings.some((s) => s.includes(phrase))) fail('Copy phrases', `copyPhrases[${i}] "${phrase}" is not in this client's copy. The list holds the client's own approved lines only.`);
  });
  if (!Array.isArray(cfg.copyPhrases) || !cfg.copyPhrases.length) amber('Copy phrases', 'No copyPhrases list. Add the approved lines that must survive every rebuild (headline, CTA, key promises).');

  // R4 pending markers
  walk(cfg, (s, p, pending) => {
    if (!pending) return;
    if (strict) fail('R4 PENDING marker', `PENDING: ${s.pending} (${p}). Gate B / live builds fail on any pending item.`);
    else amber('R4 PENDING marker', `PENDING: ${s.pending} (${p}) – shown as a neutral line on the preview; must be resolved before Gate B.`);
  });

  // R5 preview
  if (preview && !/^https:\/\//.test(cfg.preview?.testFormAction || '')) fail('R5 Preview mode', 'Preview builds need preview.testFormAction (an https Propulsion test inbox). Preview forms never post to the client.');
  if (preview && cfg.preview?.testFormAction && cfg.preview.testFormAction === cfg.form?.action) fail('R5 Preview mode', 'preview.testFormAction is the same as the live form.action. The preview form must post to the test inbox only.');

  // R8 internal reference: never deployed
  if (cfg.internalReference === true && strict) fail('R8 Internal reference', 'This is an INTERNAL REFERENCE build (internalReference: true). It is never deployed, so a Gate B / --strict build is refused.');
  if (cfg.internalReference === true && cfg.demo === true) fail('R8 Internal reference', 'A client cannot be both demo and internalReference.');

  // Trust strip
  if ((cfg.trustStrip || []).length > 3) fail('Config', 'trustStrip allows at most 3 items.');
  (cfg.trustStrip || []).forEach((t, i) => { if (!t.source || !String(t.source).trim()) fail('Config', `trustStrip[${i}] ("${t.title || t.text}") has no "source" note. Every trust fact needs its proof noted.`); });
  if (cfg.demo !== true && /\bDEMO\b/.test(JSON.stringify(cfg))) amber('Config', 'This client is not marked demo but contains the word DEMO.');
  return out;
}
