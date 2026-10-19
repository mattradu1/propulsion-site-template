// Brand brief (7 sections, from the 17 Oct Brand, Art Direction & Build Standard):
// idealClient · buyerFears (in review words) · onliness · archetype · voice (use/avoid) · proofOnFile · conflicts.
// The brief never writes copy. It orders the home page and feeds two guards (fear quotes, avoid words).
import { isPending, baShown } from './config.mjs';

export const ARCHETYPES = ['Innocent', 'Everyman', 'Hero', 'Outlaw', 'Explorer', 'Creator', 'Ruler', 'Magician', 'Lover', 'Caregiver', 'Jester', 'Sage', 'Craftsman'];

// Home-page section keys a buyer fear can be answered by.
export function sectionKeys(cfg) {
  const keys = [];
  if (cfg.intro) keys.push('intro');
  for (const s of cfg.stories || []) keys.push(`story:${s.id}`);
  if ((cfg.projects || []).some((p) => p.pairs?.length)) keys.push('work');
  if (baShown(cfg).length) keys.push('beforeAfter');
  if (cfg.process?.steps?.length) keys.push('process');
  if (cfg.owner?.name) keys.push('owner');
  if ((cfg.services || []).length) keys.push('services');
  if ((cfg.reviews || []).length) keys.push('reviews');
  keys.push('areas');
  return keys;
}

// Default order, then the client's own homeOrder, then buyer fears pull their answering sections forward
// (fear 1's section first). Intro always stays first when present.
export function homeOrder(cfg) {
  const avail = sectionKeys(cfg);
  let order = Array.isArray(cfg.homeOrder) ? cfg.homeOrder.filter((k) => avail.includes(k)) : [];
  for (const k of avail) if (!order.includes(k)) order.push(k);
  const fears = Array.isArray(cfg.brief?.buyerFears) ? cfg.brief.buyerFears : [];
  const front = [];
  for (const f of fears) if (f && avail.includes(f.answeredBy) && !front.includes(f.answeredBy) && f.answeredBy !== 'intro') front.push(f.answeredBy);
  if (front.length) {
    const rest = order.filter((k) => !front.includes(k) && k !== 'intro');
    order = [...(avail.includes('intro') ? ['intro'] : []), ...front, ...rest];
  }
  return order;
}

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

export function checkBrief(cfg, fail, amber) {
  const b = cfg.brief;
  if (!b) { amber('Brief', 'No brand brief in client.json. The home page uses the default section order.'); return; }
  for (const k of ['idealClient', 'onliness', 'archetype']) {
    const v = b[k];
    if (v == null || (typeof v === 'string' && !v.trim())) fail('Brief', `brief.${k} is empty. Fill it from the brand brief, or mark it { "pending": "…" }.`);
  }
  if (typeof b.archetype === 'string') {
    const parts = b.archetype.split(/\s*\+\s*/);
    const bad = parts.filter((p) => !ARCHETYPES.includes(p));
    if (bad.length) fail('Brief', `brief.archetype "${b.archetype}" uses ${bad.join(', ')}, which is not one of: ${ARCHETYPES.join(', ')} (combine two with "+").`);
  }
  if (!isPending(b.buyerFears)) {
    if (!Array.isArray(b.buyerFears) || !b.buyerFears.length) fail('Brief', 'brief.buyerFears needs at least one fear (in the customer\'s words), or { "pending": "…" }.');
    const keys = sectionKeys(cfg);
    (Array.isArray(b.buyerFears) ? b.buyerFears : []).forEach((f, i) => {
      if (!f?.fear) fail('Brief', `brief.buyerFears[${i}] has no "fear".`);
      if (f?.quote) {
        const rv = (cfg.reviews || []).find((r) => r.id === f.reviewId) || (cfg.reviews || []).find((r) => norm(r.text).includes(norm(f.quote)));
        if (!rv || !norm(rv.text).includes(norm(f.quote.replace(/…$/, ''))))
          fail('Brief', `brief.buyerFears[${i}].quote "${f.quote}" is not word for word from ${f.reviewId ? `review ${f.reviewId}` : 'any review on file'}. Buyer fears are written in review words only.`);
      } else amber('Brief', `brief.buyerFears[${i}] ("${f?.fear}") has no review quote behind it.`);
      if (f?.answeredBy && !keys.includes(f.answeredBy)) fail('Brief', `brief.buyerFears[${i}].answeredBy "${f.answeredBy}" is not a section on this site (${keys.join(', ')}).`);
    });
  }
  if (b.voice && !isPending(b.voice)) {
    for (const k of ['use', 'avoid']) if (b.voice[k] != null && !Array.isArray(b.voice[k])) fail('Brief', `brief.voice.${k} must be a list of words.`);
  }
}

// Voice "avoid" words found in text (case-insensitive, whole words).
export function avoidHits(cfg, text) {
  const avoid = Array.isArray(cfg.brief?.voice?.avoid) ? cfg.brief.voice.avoid : [];
  return avoid.filter((w) => typeof w === 'string' && w.trim() && new RegExp(`\\b${w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
}
