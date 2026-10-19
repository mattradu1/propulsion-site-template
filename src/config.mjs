// Reading client.json (v3): pending markers, the string walker, v1 → v2 shorthands, image slots.
export const isPending = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.pending === 'string';
export const has = (v) => isPending(v) || (typeof v === 'string' && v.trim().length > 0);
export const str = (v) => (typeof v === 'string' ? v : '');

// Walk every string (and pending marker) in the config with its JSON path.
export function walk(o, cb, p = '') {
  if (isPending(o)) return cb(o, p, true);
  if (typeof o === 'string') return cb(o, p, false);
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, cb, `${p}[${i}]`));
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, cb, p ? `${p}.${k}` : k);
}

// Accept v1 shorthands so older configs still read, then fill defaults. Never invents copy.
export function normalize(raw) {
  const cfg = structuredClone(raw);
  cfg.theme = cfg.theme || 'craft';
  if (Array.isArray(cfg.process)) cfg.process = { steps: cfg.process };
  cfg.projects = (cfg.projects || []).map((p) => {
    if (p.pairs) return p;
    const { day, evening, ...rest } = p;
    return { ...rest, pairs: day ? [{ day, evening }] : [] };
  });
  const pg = cfg.pages || {};
  const page = (k, dflt) => (pg[k] === false ? false : pg[k] === true || pg[k] == null ? (dflt ? {} : false) : pg[k]);
  cfg.pages = {
    work: page('work', true),
    about: page('about', true),
    services: page('services', !!(cfg.services || []).length),
    ideas: page('ideas', false),
    consultation: page('consultation', true),
  };
  if (cfg.pages.services && !(cfg.services || []).length) cfg.pages.services = false;
  cfg.stories = (cfg.stories || []).map((s, i) => ({ id: s.id || `s${i + 1}`, ...s }));
  cfg.reviews = (cfg.reviews || []).map((r, i) => ({ id: r.id || `r${i + 1}`, ...r }));
  cfg.copy = cfg.copy || {};
  return cfg;
}

export const IDEAS_MAX = 12;
export const heroKind = (cfg) => ({ B: 'heroSplit', C: 'heroInset' }[cfg.variant] || 'hero');

// Every image slot in the config with its crop kind (sizes in src/images.mjs).
export function imageRefs(cfg) {
  const refs = [];
  const push = (where, img, kind, extra = {}) => img?.src && refs.push({ where, ...img, kind, ...extra });
  push('hero.image', cfg.hero?.image, heroKind(cfg), { own: true });
  (cfg.projects || []).forEach((p, i) => (p.pairs || []).forEach((pr, j) => {
    const kind = pr.wide ? 'projectWide' : 'project';
    push(`projects[${i}].pairs[${j}].day`, pr.day, kind, { own: true });
    push(`projects[${i}].pairs[${j}].evening`, pr.evening, kind, { own: true });
  }));
  (cfg.stories || []).forEach((s, i) => push(`stories[${i}].image`, s.image, 'section', { own: true }));
  (cfg.beforeAfter?.pairs || []).forEach((p, i) => {
    push(`beforeAfter.pairs[${i}].before`, p.before, 'compare', { own: true });
    push(`beforeAfter.pairs[${i}].after`, p.after, 'compare', { own: true });
  });
  push('process.image', cfg.process?.image, 'portrait', { own: true });
  if (cfg.owner?.photo && cfg.owner.photoConfirmed === true) refs.push({ where: 'owner.photo', src: cfg.owner.photo, alt: cfg.owner.alt, kind: 'portrait', own: true });
  for (const k of ['work', 'about', 'services']) push(`pages.${k}.image`, cfg.pages?.[k]?.image, 'section', { own: true });
  push('cta.image', cfg.cta?.image, 'section', { own: true });
  push('brand.logo', cfg.brand?.logo, 'logo', { decorative: true });
  (cfg.pages?.ideas?.images || []).forEach((im, i) => push(`pages.ideas.images[${i}]`, im, 'thumb', { supplier: true }));
  return refs;
}

// Which supplier images actually render (written permission only; internal reference may show pending).
export function ideasShown(cfg) {
  const imgs = cfg.pages?.ideas?.images || [];
  if (!cfg.pages?.ideas || !imgs.length) return [];
  const perm = cfg.supplierImagesPermission;
  if (perm === true || (isPending(perm) && cfg.internalReference === true)) return imgs.slice(0, IDEAS_MAX);
  return [];
}

// v3 proof line: only confirmed facts, each with its source noted; accreditations also need proof on file.
// A number is a JSON number (never a string), so it is the client's figure as given, and it may count up.
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isInteger(v);
export const fmtNum = (v) => v.toLocaleString('en-GB');
export function proofShown(cfg) {
  const items = Array.isArray(cfg.proofLine?.items) ? cfg.proofLine.items : [];
  return items.filter((x) => x && x.confirmed === true && typeof x.source === 'string' && x.source.trim()
    && (x.kind !== 'accreditation' || (typeof x.proof === 'string' && x.proof.trim().length >= 5))
    && (isNum(x.value) ? typeof x.label === 'string' && x.label.trim() : typeof x.text === 'string' && x.text.trim() && x.value == null)).slice(0, 4);
}

// v3 before/after: real pairs of the same job the client supplied (sameJob + source), or a labelled DEMO pair
// on a demo client. Anything else is never rendered.
export function baShown(cfg) {
  const pairs = Array.isArray(cfg.beforeAfter?.pairs) ? cfg.beforeAfter.pairs : [];
  const okImg = (im) => im && typeof im.src === 'string' && typeof im.alt === 'string' && im.alt.trim();
  return pairs.filter((p) => p && okImg(p.before) && okImg(p.after) && p.before.src !== p.after.src
    && ((p.sameJob === true && typeof p.source === 'string' && p.source.trim())
      || (p.demoImages === true && cfg.demo === true && typeof p.demoNote === 'string' && /\bDEMO\b/.test(p.demoNote))));
}
