// Checks on client.json before anything is rendered.
// Each problem: { guard, level: 'fail' | 'amber', msg } with a plain-English message.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pairsFor } from './contrast.mjs';
import { approvedSet, findClaims } from './claims.mjs';

export const isPending = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.pending === 'string';

// Walk every string (and pending marker) in the config with its JSON path.
export function walk(o, cb, p = '') {
  if (isPending(o)) return cb(o, p, true);
  if (typeof o === 'string') return cb(o, p, false);
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, cb, `${p}[${i}]`));
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, cb, p ? `${p}.${k}` : k);
}

const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^44/, '0');
const PREVIEW_HOSTS = /(\.vercel\.app|\.netlify\.app|\.pages\.dev|\.github\.io|sitedrop|localhost|127\.0\.0\.1|ngrok)/i;
const URL_FIELDS = ['gbpUrl', 'reviewUrl', 'funnelUrl', 'domain'];

export function imageRefs(cfg) {
  const refs = [];
  if (cfg.hero?.image) refs.push({ where: 'hero.image', ...cfg.hero.image, kind: 'hero' });
  (cfg.projects || []).forEach((p, i) => {
    if (p.day) refs.push({ where: `projects[${i}].day`, ...p.day, kind: 'project' });
    if (p.evening) refs.push({ where: `projects[${i}].evening`, ...p.evening, kind: 'project' });
  });
  if (cfg.owner?.photo && cfg.owner.photoConfirmed === true)
    refs.push({ where: 'owner.photo', src: cfg.owner.photo, alt: cfg.owner.alt, kind: 'owner' });
  return refs;
}

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

export function checkConfig(cfg, { clientDir, strict, preview, others = [] }) {
  const out = [];
  const fail = (guard, msg) => out.push({ guard, level: 'fail', msg });
  const amber = (guard, msg) => out.push({ guard, level: 'amber', msg });

  // Basics
  for (const k of ['slug', 'businessName', 'legalName', 'companyNumber', 'phone', 'phoneE164', 'email', 'trade', 'domain'])
    if (!cfg[k] || (typeof cfg[k] === 'string' && !cfg[k].trim())) fail('Config', `"${k}" is missing in client.json. Every client fact must come from the config.`);
  if (!['I', 'we'].includes(cfg.voice)) fail('Config', `"voice" must be "I" or "we" (found ${JSON.stringify(cfg.voice)}).`);
  if (!Array.isArray(cfg.areasServed) || !cfg.areasServed.length) fail('Config', '"areasServed" needs at least one town.');
  if (!cfg.areasFooterLine) fail('Config', '"areasFooterLine" is missing (the short areas sentence for the footer).');
  if (!Array.isArray(cfg.process) || cfg.process.length < 3 || cfg.process.length > 5) fail('Config', `"process" needs 3 to 5 steps (found ${cfg.process?.length ?? 0}).`);
  if (cfg.phoneE164 && digits(cfg.phoneE164) !== digits(cfg.phone)) fail('Config', `"phoneE164" (${cfg.phoneE164}) does not dial the display number "${cfg.phone}". Tap-to-call would ring the wrong number.`);
  for (const k of ['gbpUrl', 'reviewUrl']) if (cfg[k] && /share\.google|goo\.gl|g\.page/i.test(cfg[k])) fail('Config', `"${k}" is a short share link (${cfg[k]}). Use the full Google Business Profile URL.`);

  // G2 alt text
  for (const r of imageRefs(cfg)) {
    if (r.decorative === true) continue;
    if (!r.alt || !String(r.alt).trim()) fail('G2 Alt text', `The image "${r.src}" at ${r.where} has no alt text. Add "alt" in client.json, or mark it "decorative": true if it carries no information.`);
  }

  // G3 contrast
  const c = cfg.brand?.colors || {};
  const need = ['text', 'background', 'surface', 'accent', 'accentText', 'muted'];
  const missing = need.filter((k) => !c[k]);
  if (missing.length) fail('G3 Contrast', `brand.colors is missing: ${missing.join(', ')}.`);
  else {
    try {
      for (const p of pairsFor(c, cfg.variant))
        if (!p.ok) fail('G3 Contrast', `Colour pair ${p.fg} ${c[p.fg]} on ${p.bg} ${c[p.bg]} (${p.where}) is ${p.ratio}:1. It needs at least ${p.min}:1. Darken or lighten one of them.`);
    } catch (e) { fail('G3 Contrast', `brand.colors: ${e.message}.`); }
  }
  const fam = new Set(Object.values(cfg.brand?.fonts || {}));
  if (fam.size > 2) fail('G9 Third-party assets', `brand.fonts lists ${fam.size} families; the limit is 2.`);

  // G4 privacy
  for (const k of ['registeredAddress', 'icoNumber', 'lastUpdated', 'formHost', 'emailHost']) {
    const v = cfg.privacy?.[k];
    if (isPending(v)) continue; // reported by R4
    if (v == null || (typeof v === 'string' && !v.trim())) fail('G4 Privacy', `privacy.${k} is empty. The privacy page cannot be built without it.${k === 'icoNumber' ? ' Use the ICO number, "not registered", or { "pending": "ICO number" } while the client checks.' : ''}`);
  }

  // G5 funnel
  if (!cfg.funnelUrl) fail('G5 Funnel URL', 'funnelUrl is missing. Every CTA needs somewhere to go.');
  else if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(cfg.funnelUrl)) fail('G5 Funnel URL', `funnelUrl "${cfg.funnelUrl}" is not an https:// address.`);
  if (!cfg.utm?.source || !cfg.utm?.medium || !cfg.utm?.campaign) fail('G5 Funnel URL', 'utm needs source, medium and campaign so every CTA is tracked.');

  // G6 phone vs Google Business Profile
  if (digits(cfg.phone) !== digits(cfg.gbpPhone)) {
    if (cfg.phoneMismatchApproved && String(cfg.phoneMismatchApproved).trim()) amber('G6 Phone match', `Site phone ${cfg.phone} differs from GBP ${cfg.gbpPhone}; approved: "${cfg.phoneMismatchApproved}".`);
    else fail('G6 Phone match', `The site phone "${cfg.phone}" does not match the Google Business Profile phone "${cfg.gbpPhone ?? '(missing)'}". Fix one of them, or add "phoneMismatchApproved": "<reason>".`);
  }

  // G10 truncated reviews
  (cfg.reviews || []).forEach((r, i) => {
    if (r.truncated === true && !String(r.text || '').trimEnd().endsWith('…'))
      fail('G10 Review cuts', `Review ${i + 1} by ${r.author} is marked truncated but its text does not end in "…". Mark every cut with "…".`);
    if (!r.source || !/^https:\/\//.test(r.source)) fail('G10 Review cuts', `Review ${i + 1} by ${r.author} has no https source URL. Every review links to where it came from.`);
    if (!r.text || !r.author) fail('G10 Review cuts', `Review ${i + 1} needs both "text" (word for word) and "author".`);
  });

  // G11 owner photo
  if (cfg.owner?.photo && cfg.owner.photoConfirmed !== true)
    fail('G11 Owner photo', `owner.photo is set to "${cfg.owner.photo}" but photoConfirmed is not true. Only use the owner's photo once they have confirmed it in writing; otherwise remove "photo".`);

  // G12 domain (sitemap/robots are built from it)
  if (cfg.domain && (!/^https:\/\/[^/\s]+$/i.test(cfg.domain.replace(/\/$/, '')) || PREVIEW_HOSTS.test(cfg.domain)))
    fail('G12 Sitemap/robots domain', `domain "${cfg.domain}" must be the live https domain (no path, never a preview host like *.vercel.app). sitemap.xml and robots.txt are built from it.`);

  // G7/R6 images exist, real image files, layout eligibility
  const refs = imageRefs(cfg);
  for (const r of refs) {
    const f = path.join(clientDir, 'images', r.src || '');
    if (!r.src || !fs.existsSync(f)) { fail('Images', `Image file "${r.src}" (${r.where}) is not in clients/${cfg.slug}/images/.`); continue; }
    if (!/\.(jpe?g|png|webp)$/i.test(r.src)) fail('Images', `"${r.src}" must be a JPG, PNG or WebP. SVG, HTML and other files are quarantined, never built.`);
  }
  const usable = new Set(refs.filter((r) => r.kind !== 'owner').map((r) => r.src)).size;
  const finished = (cfg.projects || []).some((p) => p.finished === true && p.day);
  if (!['standard', 'lowPhoto'].includes(cfg.layout)) fail('R6 Layout', `layout must be "standard" or "lowPhoto" (found ${JSON.stringify(cfg.layout)}).`);
  if (cfg.layout === 'standard' && (usable < 8 || !finished))
    fail('R6 Layout', `layout "standard" needs 8 or more usable photos including a finished job (found ${usable}${finished ? '' : ', none marked finished'}). Use "lowPhoto".`);
  if (cfg.layout === 'lowPhoto' && !['text', 'vanTeam'].includes(cfg.hero?.kind))
    fail('R6 Layout', 'layout "lowPhoto" needs hero.kind "text" or "vanTeam" (with a supplied van/team photo).');
  if (cfg.layout === 'standard' && cfg.hero?.kind !== 'photo') fail('R6 Layout', 'layout "standard" needs hero.kind "photo" with hero.image.');

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
  for (const k of URL_FIELDS) if (cfg[k] && !/^https:\/\//i.test(cfg[k])) fail('R1 Unsafe content', `${k} must start with https:// (found "${cfg[k]}").`);
  if (cfg.form?.action && !/^https:\/\//.test(cfg.form.action)) fail('R1 Unsafe content', 'form.action must be https://.');
  if (cfg.brand?.fontCssUrl) fail('G9 Third-party assets', `brand.fontCssUrl loads CSS from "${cfg.brand.fontCssUrl}". Fonts and CSS must be self-hosted: put the .woff2 files in clients/${cfg.slug}/fonts/ and list them in brand.fontFiles.`);

  // R3 banned claims (config text; output text is scanned again after render)
  const approved = approvedSet(cfg);
  (cfg.approvedClaims || []).forEach((c, i) => { if (!c?.proof || String(c.proof).trim().length < 5) fail('R3 Banned claims', `approvedClaims[${i}] ("${c?.phrase}") has no "proof" note. A claim is only approved with proof on file.`); });
  walk(cfg, (s, p, pending) => {
    if (pending || /^(approvedClaims|trustStrip\[\d+\]\.source|.*Url$|domain|.*\.src$|reviews\[\d+\]\.source)/.test(p)) return;
    for (const b of findClaims(s, approved)) fail('R3 Banned claims', `${p} uses "${b.phrase}" ("${s.slice(0, 70)}"). Remove it, or add it to approvedClaims with a proof note Matt has checked.`);
  });

  // R4 pending markers
  walk(cfg, (s, p, pending) => {
    if (!pending) return;
    if (strict) fail('R4 PENDING marker', `PENDING: ${s.pending} (${p}). Gate B / live builds fail on any pending item.`);
    else amber('R4 PENDING marker', `PENDING: ${s.pending} (${p}) – shown as a neutral line on the preview; must be resolved before Gate B.`);
  });

  // R5 preview
  if (preview && !/^https:\/\//.test(cfg.preview?.testFormAction || '')) fail('R5 Preview mode', 'Preview builds need preview.testFormAction (an https Propulsion test inbox). Preview forms never post to the client.');
  if (preview && cfg.preview?.testFormAction && cfg.preview.testFormAction === cfg.form?.action) fail('R5 Preview mode', 'preview.testFormAction is the same as the live form.action. The preview form must post to the test inbox only.');

  // Trust strip
  if ((cfg.trustStrip || []).length > 3) fail('Config', 'trustStrip allows at most 3 items.');
  (cfg.trustStrip || []).forEach((t, i) => { if (!t.source || !String(t.source).trim()) fail('Config', `trustStrip[${i}] ("${t.text}") has no "source" note. Every trust fact needs its proof noted.`); });
  if (cfg.demo !== true && /\bDEMO\b/.test(JSON.stringify(cfg))) amber('Config', 'This client is not marked demo but contains the word DEMO.');
  return out;
}
