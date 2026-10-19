// Checks on the built /dist folder. Same problem shape as guards-config.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { approvedSet, findClaims } from './claims.mjs';

export const listFiles = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile()).map((d) => path.join(d.parentPath ?? d.path, d.name));

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export const visibleText = (html) => decode(html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const attrValues = (html) => [...html.matchAll(/\s(href|src|alt|content|placeholder|title|aria-label|action|value)="([^"]*)"/gi)].map((m) => ({ name: m[1].toLowerCase(), v: decode(m[2]) }));
const headText = (html) => [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1])).join(' ');
const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^44/, '0');

const PLACEHOLDER = [/\[[^\]]*\]/, /TO BE SUPPLIED/i, /\bTBC\b/, /lorem/i, /\[FUNNEL_URL\]/, /\[LOCATION\]/, /\{\{|\}\}/, /\bundefined\b/, /\[object Object\]/, /\bNaN\b/];
const CAMERA_TAGS = /^(GPS|Make$|Model$|SerialNumber|LensModel|LensMake|CameraSerial|BodySerial|OwnerName|DateTimeOriginal$|Software$)/;

export function exifScan(dir) {
  // Returns [{file, tags[]}] with GPS/camera tags found. exiftool first; exifr fallback.
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

export function checkOutput(outDir, cfg, { strict, preview, others = [], selfHashes = new Set() }) {
  const out = [];
  const fail = (guard, msg) => out.push({ guard, level: 'fail', msg });
  const amber = (guard, msg) => out.push({ guard, level: 'amber', msg });
  const files = listFiles(outDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const rel = (f) => path.relative(outDir, f);
  const domain = cfg.domain.replace(/\/$/, '');
  const funnel = cfg.funnelUrl;
  const allowHosts = new Set([domain, cfg.funnelUrl, cfg.gbpUrl, cfg.reviewUrl, cfg.form?.action, cfg.preview?.testFormAction, 'https://ico.org.uk', ...(cfg.reviews || []).map((r) => r.source), ...(cfg.allowHosts || [])]
    .filter(Boolean).map((u) => { try { return new URL(u).host; } catch { return null; } }).filter(Boolean));
  const approved = approvedSet(cfg);
  const otherIds = others.map((o) => ({
    name: o.cfg.businessName,
    phones: new Set([o.cfg.phone, o.cfg.gbpPhone, o.cfg.phoneE164].filter(Boolean).map(digits)),
    emails: new Set([o.cfg.email].filter(Boolean).map((e) => e.toLowerCase())),
    names: [o.cfg.businessName, o.cfg.legalName].filter((n) => n && n !== cfg.businessName && n !== cfg.legalName),
    hashes: o.hashes,
  }));

  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const text = visibleText(html);
    const attrs = attrValues(html);
    const page = rel(f);

    // G1 placeholders
    for (const re of PLACEHOLDER) {
      const m = text.match(re) || headText(html).match(re);
      if (m) fail('G1 Placeholders', `${page}: placeholder text "${m[0]}" is visible on the page. Fill it from client.json or remove it.`);
      const a = attrs.find((x) => re.test(x.v));
      if (a) fail('G1 Placeholders', `${page}: placeholder "${a.v.match(re)[0]}" in a ${a.name} attribute.`);
    }
    if (/PENDING:/.test(text)) (strict ? fail : amber)('R4 PENDING marker', `${page}: a visible "PENDING:" marker.`);
    if (/data-pending=/.test(html) && strict) fail('R4 PENDING marker', `${page}: still shows a neutral line for a pending item. Resolve it before Gate B.`);

    // G2 alt on every image
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\salt="/i.test(m[0])) fail('G2 Alt text', `${page}: an image has no alt attribute (${m[0].slice(0, 80)}…).`);
      if (!/\swidth="\d+"/.test(m[0]) || !/\sheight="\d+"/.test(m[0])) fail('Images', `${page}: an image is missing width/height (${m[0].slice(0, 80)}…).`);
    }

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
    if (/<(iframe|object|embed)\b/i.test(html)) fail('R1 Unsafe content', `${page}: an <iframe>, <object> or <embed> is in the markup.`);
    for (const a of attrs) if (/^\s*(javascript|vbscript|data):/i.test(a.v) && ['href', 'src', 'action'].includes(a.name)) fail('R1 Unsafe content', `${page}: a ${a.v.split(':')[0]}: link.`);
    for (const a of attrs.filter((x) => ['href', 'src', 'action'].includes(x.name) && /^https?:/i.test(x.v))) {
      let host; try { host = new URL(a.v).host; } catch { host = a.v; }
      if (!allowHosts.has(host)) fail('R1 Unsafe content', `${page}: link to ${host}, which is not on this client's allow list (domain, funnel, Google profile, review sources, form host, ICO).`);
      if (a.v.startsWith('http:')) fail('R1 Unsafe content', `${page}: insecure http:// link ${a.v}.`);
    }
    if (!/<meta http-equiv="Content-Security-Policy" content="[^"]*script-src (&#39;|')self(&#39;|')/.test(html)) fail('R1 Unsafe content', `${page}: Content-Security-Policy meta is missing.`);

    // G5 UTM on every CTA
    for (const a of attrs.filter((x) => x.name === 'href' && x.v.startsWith(funnel)))
      if (!/[?&]utm_source=/.test(a.v)) fail('G5 Funnel URL', `${page}: a CTA to ${funnel} has no UTM tags.`);

    // R2 cross-client
    const phoneLike = [...html.matchAll(/(?:tel:)?\+?\d[\d\s()-]{8,}\d/g)].map((m) => digits(m[0]));
    const emails = [...html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0].toLowerCase());
    for (const o of otherIds) {
      for (const p of phoneLike) if (o.phones.has(p)) fail('R2 Cross-client', `${page}: contains ${o.name}'s phone number (${p}). Another client's details must never appear. Site quarantined.`);
      for (const e of emails) if (o.emails.has(e)) fail('R2 Cross-client', `${page}: contains ${o.name}'s email (${e}). Site quarantined.`);
      for (const n of o.names) if (text.toLowerCase().includes(n.toLowerCase())) amber('R2 Cross-client', `${page}: mentions "${n}" (another client's name). Name-only match: check it.`);
    }

    // R3 banned claims (template copy + client copy as rendered)
    for (const b of findClaims(text + ' ' + headText(html) + ' ' + attrs.filter((x) => ['content', 'alt'].includes(x.name)).map((x) => x.v).join(' '), approved))
      fail('R3 Banned claims', `${page}: the page says "${b.phrase}". Not allowed unless it is in approvedClaims with proof.`);

    // R5 preview
    const banner = /Preview – not live/.test(text);
    const noindex = /<meta name="robots" content="noindex/.test(html);
    const actions = [...html.matchAll(/<form\b[^>]*action="([^"]*)"/gi)].map((m) => decode(m[1]));
    if (preview) {
      if (!banner) fail('R5 Preview mode', `${page}: the "Preview – not live" banner is missing.`);
      if (!noindex) fail('R5 Preview mode', `${page}: preview page is not marked noindex.`);
      for (const a of actions) if (a !== cfg.preview.testFormAction) fail('R5 Preview mode', `${page}: preview form posts to ${a}, not the test inbox.`);
    } else {
      if (banner) fail('R5 Preview mode', `${page}: live build still shows the preview banner.`);
      if (noindex && !page.startsWith('404')) fail('R5 Preview mode', `${page}: live build is marked noindex.`);
    }

    // Accessibility structure
    const h1 = (html.match(/<h1\b/gi) || []).length;
    if (h1 !== 1) fail('A11y structure', `${page}: has ${h1} H1 headings; every page needs exactly one.`);
    if ((html.match(/<main\b/gi) || []).length !== 1) fail('A11y structure', `${page}: needs exactly one <main> landmark.`);
    if (!/<body[^>]*>\s*<a class="skip" href="#main">/.test(html)) fail('A11y structure', `${page}: the skip link is not the first focusable element.`);
    let last = 0;
    for (const m of html.matchAll(/<h([1-6])\b/gi)) { const l = +m[1]; if (last && l > last + 1) { fail('A11y structure', `${page}: heading jumps from H${last} to H${l}.`); break; } last = l; }
    const title = headText(html);
    if (!title) fail('SEO basics', `${page}: no <title>.`); else if (title.length > 60) amber('SEO basics', `${page}: title is ${title.length} characters (aim ≤60): "${title}".`);
    const md = html.match(/<meta name="description" content="([^"]*)"/);
    if (!md || !md[1].trim()) fail('SEO basics', `${page}: no meta description.`);
    if (!/<link rel="canonical" href="https:\/\//.test(html) || !/property="og:title"/.test(html)) fail('SEO basics', `${page}: canonical or Open Graph tags missing.`);
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/);
    if (canon && !canon[1].startsWith(domain + '/')) fail('G12 Sitemap/robots domain', `${page}: canonical ${canon[1]} is not on ${domain}.`);
  }

  // R2 images by fingerprint
  for (const o of otherIds) for (const hsh of selfHashes) if (o.hashes.has(hsh)) fail('R2 Cross-client', `One of this client's source images is identical to an image in ${o.name}'s folder (file fingerprint match). Never reuse another client's photos.`);

  // CSS: no third-party imports
  for (const f of files.filter((x) => x.endsWith('.css'))) {
    const css = fs.readFileSync(f, 'utf8');
    if (/@import|url\(\s*["']?(https?:)?\/\//i.test(css)) fail('G9 Third-party assets', `${rel(f)}: CSS imports or loads something from another host.`);
  }

  // G12 sitemap + robots
  const sm = path.join(outDir, 'sitemap.xml'), rb = path.join(outDir, 'robots.txt');
  if (!fs.existsSync(sm) || !fs.existsSync(rb)) fail('G12 Sitemap/robots domain', 'sitemap.xml or robots.txt is missing from the build.');
  else {
    const locs = [...fs.readFileSync(sm, 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    if (!locs.length) fail('G12 Sitemap/robots domain', 'sitemap.xml lists no pages.');
    for (const l of locs) if (!l.startsWith(domain + '/')) fail('G12 Sitemap/robots domain', `sitemap.xml lists ${l}, which is not on ${domain}.`);
    const robots = fs.readFileSync(rb, 'utf8');
    const smLine = robots.match(/^sitemap:\s*(\S+)/im);
    if (!smLine || smLine[1] !== domain + '/sitemap.xml') fail('G12 Sitemap/robots domain', `robots.txt Sitemap line is "${smLine?.[1] ?? 'missing'}"; it must be ${domain}/sitemap.xml.`);
  }

  // R5 host config
  const vj = path.join(outDir, 'vercel.json');
  if (!fs.existsSync(vj)) fail('Host config', 'vercel.json is missing, so a static host may return 200 for unknown pages.');
  else {
    const v = fs.readFileSync(vj, 'utf8');
    if (preview && !/X-Robots-Tag[\s\S]*noindex/.test(v)) fail('R5 Preview mode', 'vercel.json has no X-Robots-Tag noindex header for this preview build.');
    if (!preview && /X-Robots-Tag/.test(v)) fail('R5 Preview mode', 'Live build vercel.json still sends X-Robots-Tag.');
  }
  if (!fs.existsSync(path.join(outDir, '404.html'))) fail('Host config', '404.html is missing.');

  // G8 metadata
  const ex = exifScan(outDir);
  if (ex.tool === 'exifr-needed') amber('G8 Image metadata', 'exiftool is not installed, so the GPS/camera check could not run. Install exiftool (brew install exiftool).');
  for (const hit of ex.hits) fail('G8 Image metadata', `${rel(hit.file)} still carries ${hit.tags.join(', ')}. All metadata, including GPS, must be stripped.`);
  return out;
}
