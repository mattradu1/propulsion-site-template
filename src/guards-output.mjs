// Checks on the built /dist folder (v3). Same problem shape as guards-config.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { approvedSet, findClaims } from './claims.mjs';
import { normalize, walk, isPending, ideasShown, IDEAS_MAX, proofShown, isNum, fmtNum } from './config.mjs';
import { approvedStrings, LINES } from './lines.mjs';
import { h1Problems, PREVIEW_HOSTS } from './guards-config.mjs';
import { avoidHits } from './brief.mjs';

export const listFiles = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile()).map((d) => path.join(d.parentPath ?? d.path, d.name));

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const stripNonText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<head[\s\S]*?<\/head>/i, ' ');
export const visibleText = (html) => decode(stripNonText(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const attrValues = (html) => [...html.matchAll(/\s(href|src|srcset|alt|content|placeholder|title|aria-label|action|value|cite)="([^"]*)"/gi)].map((m) => ({ name: m[1].toLowerCase(), v: decode(m[2]) }));
const headText = (html) => [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1])).join(' ');
const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^44/, '0');
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const routeOf = (rel) => (rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? '/' + rel.slice(0, -'index.html'.length) : '/' + rel);

const PLACEHOLDER = [/\[[^\]]*\]/, /TO BE SUPPLIED/i, /TO CONFIRM/i, /\bTBC\b/, /lorem/i, /\[FUNNEL_URL\]/, /\[LOCATION\]/, /\{\{|\}\}/, /\bundefined\b/, /\[object Object\]/, /\bNaN\b/, /Location to be confirmed/i];
const CAMERA_TAGS = /^(GPS|Make$|Model$|SerialNumber|LensModel|LensMake|CameraSerial|BodySerial|OwnerName|DateTimeOriginal$|Software$)/;

export function exifScan(dir) {
  const imgs = listFiles(dir).filter((f) => /\.(webp|jpe?g|png|gif|avif|tiff?|heic)$/i.test(f));
  if (!imgs.length) return { tool: 'none', hits: [] };
  try {
    const out = execFileSync('exiftool', ['-j', '-a', '-s', '-G1', ...imgs], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const hits = JSON.parse(out).map((o) => ({ file: o.SourceFile, tags: Object.keys(o).filter((k) => k.includes(':')).map((k) => k.split(':')[1]).filter((k) => CAMERA_TAGS.test(k)) })).filter((x) => x.tags.length);
    return { tool: 'exiftool', hits };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return { tool: 'exifr-needed', hits: [] };
  }
}

// Copy traceability (engine rulebook S5 r7): every visible text node must be a client.json string,
// an approved template line, or a derived value (year, review date). Approved legal text is fenced
// with <!--approved:…--> and only allowed on the privacy page.
export function untraceable(html, cfg, page) {
  const allowed = new Set([...approvedStrings()].map(squash));
  walk(cfg, (s, p, pending) => { if (!pending) allowed.add(squash(s)); else if (cfg.internalReference === true) allowed.add(squash('PENDING: ' + s.pending)); });
  for (const x of proofShown(cfg)) if (isNum(x.value)) allowed.add(fmtNum(x.value)); // v3: a proof-line number as written in client.json
  let body = html.replace(/<head[\s\S]*?<\/head>/i, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // v3: the hero H1 is split into one span per word for the reveal; trace it as the one line it is.
  body = body.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (m, a, inner) => `<h1${a}>${inner.replace(/<[^>]+>/g, '')}</h1>`);
  if (page === 'privacy/index.html') body = body.replace(/<!--approved:privacy-v2-->[\s\S]*?<!--\/approved-->/g, ' ');
  body = body.replace(/<!--[\s\S]*?-->/g, ' ');
  const bad = [];
  for (const chunk of body.split(/<[^>]+>/)) {
    const raw = squash(decode(chunk));
    if (!raw || /^[\s·,.:;|–—\-()&+/]+$/.test(raw)) continue;
    const core = raw.replace(/^[\s·,.:;|–—-]+|[\s·,:;|–—-]+$/g, '');
    if (allowed.has(raw) || allowed.has(core)) continue;
    if (/^© \d{4}$/.test(core) || /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/.test(core)) continue;
    bad.push(raw.slice(0, 80));
  }
  return bad;
}

// Six-size type scale, restraint tokens, token-only colours and fonts, in the compiled CSS.
export function cssProblems(css) {
  const out = [];
  const faces = [...css.matchAll(/@font-face\s*{[^}]*}/g)].map((m) => m[0]);
  const families = new Set(faces.map((f) => (f.match(/font-family:\s*"?([^";]+)"?/) || [])[1]).filter(Boolean));
  if (families.size > 2) out.push(['G9 Third-party assets', `site.css declares ${families.size} font families (${[...families].join(', ')}); the limit is 2.`]);
  const rest = css.replace(/@font-face\s*{[^}]*}/g, '');
  const scale = new Set([...rest.matchAll(/--fs-([0-9]+)\s*:/g)].map((m) => m[1]));
  if (scale.size !== 6 || [...scale].some((n) => +n < 1 || +n > 6)) out.push(['Type scale', `The type scale defines ${scale.size} sizes (--fs-${[...scale].join(', --fs-')}). It must be exactly six: --fs-1 to --fs-6.`]);
  for (const m of rest.matchAll(/(?:^|[;{\s])font-size\s*:\s*([^;}]+)/g)) if (!/^\s*(var\(--fs-[1-6]\)|inherit)\s*(!important)?\s*$/.test(m[1])) out.push(['Type scale', `site.css sets font-size: ${m[1].trim()}. Every size must be one of the six tokens var(--fs-1) … var(--fs-6).`]);
  for (const m of rest.matchAll(/(?:^|[;{\s])font\s*:\s*([^;}]+)/g)) if (!/^\s*inherit\s*$/.test(m[1])) out.push(['Type scale', `site.css uses the font shorthand (font: ${m[1].trim()}), which bypasses the type scale.`]);
  for (const m of rest.matchAll(/(?:^|[;{\s])font-family\s*:\s*([^;}]+)/g)) if (!/^\s*(var\(--font-(display|text|mono)\)|inherit)\s*$/.test(m[1])) out.push(['G9 Third-party assets', `site.css sets font-family: ${m[1].trim()} directly. Use var(--font-display), var(--font-text) or var(--font-mono) (the system monospace, never downloaded).`]);
  // v3 motion: anything that animates must have a reduced-motion block that switches it off.
  if (/(animation|transition)\s*:|@keyframes/.test(rest)) {
    const rm = rest.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{([\s\S]*?})\s*}/);
    if (!rm || !/animation:none!important/.test(rm[1].replace(/\s+/g, '')) || !/transition:none!important/.test(rm[1].replace(/\s+/g, '')))
      out.push(['Reduced motion', 'site.css animates but has no @media (prefers-reduced-motion: reduce) block that sets animation and transition to none. Every motion must jump to its final state when the visitor asks for less motion.']);
  }
  if (/\b(lenis|locomotive|smooth-scroll|scroll-behavior\s*:\s*smooth)\b/i.test(rest)) out.push(['Reduced motion', 'site.css turns on smooth scrolling. Scrolling stays native (no smooth-scroll libraries or scroll-jacking).']);
  for (const m of rest.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/g)) if (!/^\s*var\(--radius\)\s*$/.test(m[1])) out.push(['Restraint tokens', `site.css rounds corners with border-radius: ${m[1].trim()}. Corners only through var(--radius) (0 unless the brand turns it on).`]);
  for (const m of rest.matchAll(/(box-shadow|text-shadow)\s*:\s*([^;}]+)/g)) if (!/^\s*(var\(--shadow\)|none)\s*$/.test(m[2])) out.push(['Restraint tokens', `site.css adds a shadow (${m[1]}: ${m[2].trim()}). Shadows only through var(--shadow) (none unless the brand turns it on).`]);
  if (/drop-shadow\(/.test(rest)) out.push(['Restraint tokens', 'site.css uses filter: drop-shadow(). Shadows only through var(--shadow).']);
  const noRoot = rest.replace(/:root\s*{[^}]*}/g, '');
  const lit = noRoot.match(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  if (lit) out.push(['Design tokens', `site.css paints a colour literal (${lit[0]}) outside :root. Colours only through the brand tokens.`]);
  if (/@import|url\(\s*["']?(https?:)?\/\//i.test(css)) out.push(['G9 Third-party assets', 'site.css imports or loads something from another host.']);
  return out;
}

export function checkOutput(outDir, rawCfg, { strict, preview, others = [], selfHashes = new Set() }) {
  const cfg = normalize(rawCfg);
  const out = [];
  const fail = (guard, msg) => out.push({ guard, level: 'fail', msg });
  const amber = (guard, msg) => out.push({ guard, level: 'amber', msg });
  const files = listFiles(outDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const rel = (f) => path.relative(outDir, f).split(path.sep).join('/');
  const domain = cfg.domain.replace(/\/$/, '');
  const funnel = typeof cfg.funnelUrl === 'string' ? cfg.funnelUrl : null;
  const internal = cfg.internalReference === true;
  const strs = (...xs) => xs.filter((x) => typeof x === 'string');
  const allowHosts = new Set([domain, ...strs(cfg.funnelUrl, cfg.gbpUrl, cfg.reviewUrl, cfg.form?.action, cfg.preview?.testFormAction), 'https://ico.org.uk', ...cfg.reviews.map((r) => r.source).filter((s) => typeof s === 'string'), ...(cfg.allowHosts || [])]
    .map((u) => { try { return new URL(u).host; } catch { return null; } }).filter(Boolean));
  const approved = approvedSet(cfg);
  const reviewText = cfg.reviews.map((r) => r.text).join(' ');
  const otherIds = others.map((o) => ({
    name: o.cfg.businessName,
    phones: new Set([o.cfg.phone, o.cfg.gbpPhone, o.cfg.phoneE164].filter((x) => typeof x === 'string').map(digits)),
    emails: new Set([o.cfg.email].filter(Boolean).map((e) => e.toLowerCase())),
    names: [o.cfg.businessName, o.cfg.legalName].filter((n) => typeof n === 'string' && n !== cfg.businessName && n !== cfg.legalName),
    hashes: o.hashes,
  }));
  let info = {};
  try { info = JSON.parse(fs.readFileSync(path.join(outDir, 'build-info.json'), 'utf8')); } catch {}
  const routes = info.routes || [];
  const exists = (p) => {
    const clean = decodeURIComponent(p.split(/[?#]/)[0]);
    const f = path.join(outDir, clean);
    if (!f.startsWith(outDir)) return false;
    if (clean.endsWith('/')) return fs.existsSync(path.join(f, 'index.html'));
    return fs.existsSync(f) && fs.statSync(f).isFile() || fs.existsSync(path.join(f, 'index.html'));
  };
  const titles = new Map();
  const shown = ideasShown(cfg).length;
  const phrases = (cfg.copyPhrases || []).map((c) => (typeof c === 'string' ? { phrase: c } : c)).filter((c) => c?.phrase);
  const allText = {};

  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const text = visibleText(html);
    const attrs = attrValues(html);
    const page = rel(f);
    const route = routeOf(page);
    allText[route] = text;

    // G1 placeholders
    for (const re of PLACEHOLDER) {
      const m = text.match(re) || headText(html).match(re);
      if (m) fail('G1 Placeholders', `${page}: placeholder text "${m[0]}" is visible on the page. Fill it from client.json or remove it.`);
      const a = attrs.find((x) => re.test(x.v));
      if (a) fail('G1 Placeholders', `${page}: placeholder "${a.v.match(re)[0]}" in a ${a.name} attribute.`);
    }
    if (/PENDING:/.test(text)) (strict ? fail : amber)('R4 PENDING marker', `${page}: a visible "PENDING:" marker.`);
    const pend = [...html.matchAll(/data-pending="([^"]*)"/g)].map((m) => decode(m[1]));
    if (pend.length && strict) fail('R4 PENDING marker', `${page}: still shows a neutral line for pending items (${[...new Set(pend)].join('; ')}). Resolve them before Gate B.`);

    // Copy traceability
    const bad = untraceable(html, cfg, page);
    for (const b of bad.slice(0, 5)) fail('Copy traceability', `${page}: "${b}" is on the page but is not in client.json or the approved template lines. No invented copy.`);

    // G2 alt + sizes on every image
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\salt="/i.test(m[0])) fail('G2 Alt text', `${page}: an image has no alt attribute (${m[0].slice(0, 80)}…).`);
      if (!/\swidth="\d+"/.test(m[0]) || !/\sheight="\d+"/.test(m[0])) fail('Images', `${page}: an image is missing width/height (${m[0].slice(0, 80)}…).`);
      if (!/fetchpriority="high"/.test(m[0]) && !/loading="lazy"/.test(m[0]) && m.index > html.indexOf('</header>')) amber('Images', `${page}: an image below the header is not lazy-loaded (${m[0].slice(0, 60)}…).`);
    }

    // v3 before/after slider: keyboard-operable and labelled, and two described photos per pair
    for (const m of html.matchAll(/<[a-z]+\b[^>]*\brole="slider"[^>]*>/gi)) {
      const tag = m[0];
      const miss = ['tabindex="0"', 'aria-valuemin="', 'aria-valuemax="', 'aria-valuenow="', 'aria-label="'].filter((a) => !tag.includes(a));
      if (miss.length) fail('Before/after slider', `${page}: a slider is missing ${miss.join(', ')}. It must work from the keyboard and say what it does.`);
    }
    for (const m of html.matchAll(/<div class="ba[^"]*" data-ba>([\s\S]*?)<\/figure>/g)) {
      const ims = [...m[1].matchAll(/<img\b[^>]*>/g)].map((x) => x[0]);
      if (ims.length !== 2 || ims.some((x) => /alt=""/.test(x))) fail('Before/after slider', `${page}: a before/after pair needs exactly two photos, each with alt text (found ${ims.length}).`);
      if (!/role="slider"/.test(m[1])) fail('Before/after slider', `${page}: a before/after pair has no keyboard slider.`);
    }
    // v3 count-up: only numbers from client.json, with the final figure already in the HTML
    const nums = new Set(proofShown(cfg).filter((x) => isNum(x.value)).map((x) => x.value));
    for (const m of html.matchAll(/<span class="num" data-count="([^"]*)">([^<]*)<\/span>/g)) {
      if (!nums.has(Number(m[1]))) fail('Count-up', `${page}: counts up to ${m[1]}, which is not a confirmed number in client.json.`);
      if (decode(m[2]) !== fmtNum(Number(m[1]))) fail('Count-up', `${page}: the counter shows "${m[2]}" in the HTML instead of its final figure ${m[1]}. The real number must be there without JavaScript.`);
    }
    if ((html.match(/data-count="/g) || []).length !== (html.match(/<span class="num" data-count="/g) || []).length) fail('Count-up', `${page}: a data-count counter is outside the proof line.`);

    // G9 third-party CSS / fonts / Tailwind CDN
    if (/cdn\.tailwindcss\.com|tailwindcss\.com\/play|unpkg\.com\/tailwind/i.test(html)) fail('G9 Third-party assets', `${page}: loads the Tailwind CDN. CSS must be compiled at build time.`);
    for (const m of html.matchAll(/<(script|link)\b[^>]*\b(src|href)="(https?:)?\/\/([^"/]+)[^"]*"[^>]*>/gi)) {
      const isAsset = m[1].toLowerCase() === 'script' || /rel="(stylesheet|preload|modulepreload|preconnect|dns-prefetch)"/i.test(m[0]);
      if (isAsset) fail('G9 Third-party assets', `${page}: loads ${m[1]} from ${m[4]}. Fonts, CSS and scripts must be self-hosted.`);
    }
    if (/fonts\.(googleapis|gstatic)\.com/i.test(html)) fail('G9 Third-party assets', `${page}: references Google Fonts. Fonts must be self-hosted.`);

    // R1 unsafe markup
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
      const a = m[1];
      if (!(/type="application\/ld\+json"/.test(a) || /^\s*src="\/assets\/site\.js" defer\s*$/.test(a))) fail('R1 Unsafe content', `${page}: unexpected <script${a}>. Only the template's own script and JSON-LD are allowed.`);
    }
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (!/application\/ld\+json/.test(m[0]) && m[1].trim()) fail('R1 Unsafe content', `${page}: inline script found.`);
    if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html)) fail('R1 Unsafe content', `${page}: an inline event handler (on…=) is in the markup.`);
    if (/<[a-z][^>]*\sstyle\s*=/i.test(html)) fail('R1 Unsafe content', `${page}: an inline style attribute is in the markup. The CSP blocks it; styles live in site.css.`);
    if (/<(iframe|object|embed)\b/i.test(html)) fail('R1 Unsafe content', `${page}: an <iframe>, <object> or <embed> is in the markup.`);
    for (const a of attrs) if (/^\s*(javascript|vbscript|data):/i.test(a.v) && ['href', 'src', 'action'].includes(a.name)) fail('R1 Unsafe content', `${page}: a ${a.v.split(':')[0]}: link.`);
    for (const a of attrs.filter((x) => ['href', 'src', 'action'].includes(x.name) && /^https?:/i.test(x.v))) {
      let host; try { host = new URL(a.v).host; } catch { host = a.v; }
      if (!allowHosts.has(host)) fail('R1 Unsafe content', `${page}: link to ${host}, which is not on this client's allow list (domain, funnel, Google profile, review sources, form host, ICO).`);
      if (a.v.startsWith('http:')) fail('R1 Unsafe content', `${page}: insecure http:// link ${a.v}.`);
    }
    if (!/<meta http-equiv="Content-Security-Policy" content="[^"]*script-src (&#39;|')self(&#39;|')/.test(html)) fail('R1 Unsafe content', `${page}: Content-Security-Policy meta is missing.`);

    // G5 UTM on every CTA
    if (funnel) for (const a of attrs.filter((x) => x.name === 'href' && x.v.startsWith(funnel)))
      if (!/[?&]utm_source=/.test(a.v)) fail('G5 Funnel URL', `${page}: a CTA to ${funnel} has no UTM tags.`);

    // R2 cross-client
    const phoneLike = [...html.matchAll(/(?:tel:)?\+?\d[\d\s()-]{8,}\d/g)].map((m) => digits(m[0]));
    const emails = [...html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0].toLowerCase());
    for (const o of otherIds) {
      for (const p of phoneLike) if (o.phones.has(p)) fail('R2 Cross-client', `${page}: contains ${o.name}'s phone number (${p}). Another client's details must never appear. Site quarantined.`);
      for (const e of emails) if (o.emails.has(e)) fail('R2 Cross-client', `${page}: contains ${o.name}'s email (${e}). Site quarantined.`);
      for (const n of o.names) if (text.toLowerCase().includes(n.toLowerCase())) amber('R2 Cross-client', `${page}: mentions "${n}" (another client's name). Name-only match: check it.`);
    }

    // R3 banned claims; voice "avoid" words (customer review words excepted)
    for (const b of findClaims(text + ' ' + headText(html) + ' ' + attrs.filter((x) => ['content', 'alt'].includes(x.name)).map((x) => x.v).join(' '), approved))
      fail('R3 Banned claims', `${page}: the page says "${b.phrase}". Not allowed unless it is in approvedClaims with proof.`);
    let ownText = text + ' ' + headText(html);
    for (const r of cfg.reviews) ownText = ownText.split(squash(r.text)).join(' ');
    for (const w of avoidHits(cfg, ownText)) fail('Voice', `${page}: uses "${w}", which the brand brief lists under voice.avoid.`);

    // R5 preview / R8 internal reference
    const banner = /Preview – not live/.test(text);
    const noindex = /<meta name="robots" content="noindex/.test(html);
    const actions = [...html.matchAll(/<form\b[^>]*action="([^"]*)"/gi)].map((m) => decode(m[1]));
    if (preview) {
      if (!banner) fail('R5 Preview mode', `${page}: the "Preview – not live" banner is missing.`);
      if (!noindex) fail('R5 Preview mode', `${page}: preview page is not marked noindex.`);
      for (const a of actions) if (a !== cfg.preview.testFormAction) fail('R5 Preview mode', `${page}: preview form posts to ${a}, not the test inbox.`);
    } else {
      if (banner) fail('R5 Preview mode', `${page}: live build still shows the preview banner.`);
      if (noindex && !internal && !page.startsWith('404')) fail('R5 Preview mode', `${page}: live build is marked noindex.`);
    }
    if (internal) {
      if (!noindex) fail('R8 Internal reference', `${page}: INTERNAL REFERENCE page is not marked noindex.`);
      if (!text.includes(LINES.internalRef)) fail('R8 Internal reference', `${page}: the footer marker "${LINES.internalRef}" is missing.`);
    }

    // Accessibility structure: one H1, first heading is the H1, no skipped levels, one <main>, skip link first
    const h1 = (html.match(/<h1\b/gi) || []).length;
    if (h1 !== 1) fail('A11y structure', `${page}: has ${h1} H1 headings; every page needs exactly one.`);
    if ((html.match(/<main\b/gi) || []).length !== 1) fail('A11y structure', `${page}: needs exactly one <main> landmark.`);
    if (!/<body[^>]*>\s*<a class="skip" href="#main">/.test(html)) fail('A11y structure', `${page}: the skip link is not the first focusable element.`);
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => +m[1]);
    if (levels.length && levels[0] !== 1) fail('Headings in order', `${page}: the first heading is H${levels[0]}; the page must open with its H1.`);
    let last = 0;
    for (const l of levels) { if (last && l > last + 1) { fail('Headings in order', `${page}: heading jumps from H${last} to H${l}.`); break; } last = l; }

    // SEO basics + canonical = final domain + this page's own path
    const title = headText(html);
    if (!title) fail('SEO basics', `${page}: no <title>.`); else if (title.length > 60) amber('SEO basics', `${page}: title is ${title.length} characters (aim ≤60): "${title}".`);
    if (title && page !== '404.html') { if (titles.has(title)) fail('SEO basics', `${page}: same <title> as ${titles.get(title)}. Every page needs its own.`); titles.set(title, page); }
    const md = html.match(/<meta name="description" content="([^"]*)"/);
    if (!md || !md[1].trim()) fail('SEO basics', `${page}: no meta description.`);
    if (!/property="og:title"/.test(html)) fail('SEO basics', `${page}: Open Graph tags missing.`);
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/);
    const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/);
    const want = domain + route;
    if (!canon) fail('Canonical', `${page}: no canonical link.`);
    else {
      if (canon[1] !== want) fail('Canonical', `${page}: canonical is ${canon[1]}; it must be this page on the final domain: ${want}.`);
      if (PREVIEW_HOSTS.test(canon[1])) fail('Canonical', `${page}: canonical points at a preview host (${canon[1]}).`);
    }
    if (ogUrl && ogUrl[1] !== want) fail('Canonical', `${page}: og:url ${ogUrl[1]} does not match the canonical ${want}.`);

    // G13 routing: every internal link, image and srcset entry resolves to a real file (direct request works)
    const refs = [];
    for (const a of attrs) {
      if (a.name === 'srcset') refs.push(...a.v.split(',').map((x) => x.trim().split(/\s+/)[0]));
      else if (['href', 'src', 'action'].includes(a.name)) refs.push(a.v);
    }
    for (const r of new Set(refs)) if (r.startsWith('/') && !r.startsWith('//') && !exists(r)) fail('G13 Routing', `${page}: links to ${r}, which does not exist in the build (a direct request would 404).`);
    const mainText = visibleText((html.match(/<main[\s\S]*<\/main>/) || [''])[0]);
    if (mainText.trim().length < 80) fail('G13 Routing', `${page}: the server HTML has almost no content (${mainText.trim().length} characters). Every route must be real HTML, not a JavaScript shell.`);

    // Ideas page: supplier images labelled, lazy, 12 max, only with permission; never elsewhere
    const sup = [...html.matchAll(/<figure class="supplier">([\s\S]*?)<\/figure>/g)];
    if (page !== 'ideas/index.html' && (sup.length || /-thumb-\d+x\d+\.webp/.test(html))) fail('Ideas page', `${page}: a supplier image appears outside the Ideas page.`);
    if (sup.length > IDEAS_MAX) fail('Ideas page', `${page}: ${sup.length} supplier images; the limit is ${IDEAS_MAX}.`);
    if (sup.length && !shown) fail('Ideas page', `${page}: supplier images are shown without written permission (supplierImagesPermission is not true).`);
    for (const s of sup) {
      if (!/loading="lazy"/.test(s[1])) fail('Ideas page', `${page}: a supplier image is not lazy-loaded.`);
      if (!s[1].includes(`<figcaption><span>${LINES.supplierImage}</span>`)) fail('Ideas page', `${page}: a supplier image is not labelled "${LINES.supplierImage}".`);
    }
  }

  // H1 on the home page says trade + area (rendered, so a tampered page is caught too)
  const home = path.join(outDir, 'index.html');
  if (fs.existsSync(home)) {
    const m = fs.readFileSync(home, 'utf8').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/);
    const h1 = m ? squash(decode(m[1].replace(/<[^>]+>/g, ' '))) : '';
    const p = h1Problems(cfg, h1);
    if (p.length) fail('H1 what/where', `index.html: the H1 "${h1}" ${p.join(' and ')}.`);
    // v3: the H1 words are in the server HTML exactly as approved (the reveal never writes or reorders text)
    else if (typeof cfg.hero?.h1 === 'string' && h1 !== squash(cfg.hero.h1)) fail('H1 server text', `index.html: the H1 in the HTML reads "${h1}", not the approved "${squash(cfg.hero.h1)}". The H1 text must be in the HTML itself, word for word.`);
  }
  // Copy-phrase integrity: each approved line must still be on its page, word for word
  for (const cp of phrases) {
    const pages = cp.page ? [cp.page] : Object.keys(allText);
    if (!pages.some((r) => (allText[r] || '').includes(squash(cp.phrase)))) fail('Copy phrases', `"${cp.phrase}" is missing from ${cp.page || 'every page'}. An approved line drifted or was dropped.`);
  }
  // Every route in build-info has its own file; titles already unique
  for (const r of routes) if (!exists(r)) fail('G13 Routing', `Route ${r} has no HTML file of its own.`);

  // R2 images by fingerprint
  for (const o of otherIds) for (const hsh of selfHashes) if (o.hashes.has(hsh)) fail('R2 Cross-client', `One of this client's source images is identical to an image in ${o.name}'s folder (file fingerprint match). Never reuse another client's photos.`);

  // CSS: type scale, restraint, tokens, no third-party loads
  for (const f of files.filter((x) => x.endsWith('.css'))) for (const [g, m] of cssProblems(fs.readFileSync(f, 'utf8'))) fail(g, `${rel(f)}: ${m}`);

  // G12 sitemap + robots
  const sm = path.join(outDir, 'sitemap.xml'), rb = path.join(outDir, 'robots.txt');
  if (!fs.existsSync(sm) || !fs.existsSync(rb)) fail('G12 Sitemap/robots domain', 'sitemap.xml or robots.txt is missing from the build.');
  else {
    const locs = [...fs.readFileSync(sm, 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    if (!locs.length) fail('G12 Sitemap/robots domain', 'sitemap.xml lists no pages.');
    for (const l of locs) {
      if (!l.startsWith(domain + '/')) fail('G12 Sitemap/robots domain', `sitemap.xml lists ${l}, which is not on ${domain}.`);
      else if (!exists(l.slice(domain.length))) fail('G13 Routing', `sitemap.xml lists ${l}, but there is no page for it.`);
    }
    const robots = fs.readFileSync(rb, 'utf8');
    const smLine = robots.match(/^sitemap:\s*(\S+)/im);
    if (!smLine || smLine[1] !== domain + '/sitemap.xml') fail('G12 Sitemap/robots domain', `robots.txt Sitemap line is "${smLine?.[1] ?? 'missing'}"; it must be ${domain}/sitemap.xml.`);
    if (internal && !/^Disallow:\s*\/\s*$/m.test(robots)) fail('R8 Internal reference', 'robots.txt does not disallow everything for an INTERNAL REFERENCE build.');
  }

  // Host config: real 404, preview/internal headers, redirects land on real pages
  const vj = path.join(outDir, 'vercel.json');
  if (!fs.existsSync(vj)) fail('Host config', 'vercel.json is missing, so a static host may return 200 for unknown pages.');
  else {
    const v = fs.readFileSync(vj, 'utf8');
    const noindexHeader = /X-Robots-Tag[\s\S]*noindex/.test(v);
    if (preview && !noindexHeader) fail('R5 Preview mode', 'vercel.json has no X-Robots-Tag noindex header for this preview build.');
    if (internal && !noindexHeader) fail('R8 Internal reference', 'vercel.json has no X-Robots-Tag noindex header for this INTERNAL REFERENCE build.');
    if (!preview && !internal && /X-Robots-Tag/.test(v)) fail('R5 Preview mode', 'Live build vercel.json still sends X-Robots-Tag.');
    let vjs = {}; try { vjs = JSON.parse(v); } catch { fail('Host config', 'vercel.json is not valid JSON.'); }
    for (const r of vjs.redirects || []) if (!exists(r.destination)) fail('G13 Routing', `Redirect ${r.source} → ${r.destination} lands on a page that does not exist.`);
  }
  if (!fs.existsSync(path.join(outDir, '404.html'))) fail('Host config', '404.html is missing.');

  // G8 metadata
  const ex = exifScan(outDir);
  if (ex.tool === 'exifr-needed') amber('G8 Image metadata', 'exiftool is not installed, so the GPS/camera check could not run. Install exiftool (brew install exiftool).');
  for (const hit of ex.hits) fail('G8 Image metadata', `${rel(hit.file)} still carries ${hit.tags.join(', ')}. All metadata, including GPS, must be stripped.`);
  return out;
}
