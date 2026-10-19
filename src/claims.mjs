// Banned claims (engine rulebook S4). A phrase may appear only if client.json
// approvedClaims has an entry { "phrase": "...", "proof": "<where the proof is on file>" }.
export const BANNED = [
  { phrase: 'best', re: /\bbest\b/i },
  { phrase: 'No.1', re: /\b(no\.?\s?1|number\s+one)\b|#1\b/i },
  { phrase: 'cheapest', re: /\bcheapest\b/i },
  { phrase: 'guaranteed results', re: /\bguaranteed\s+results?\b/i },
  { phrase: 'award-winning', re: /\baward[\s-]?winning\b/i },
  { phrase: '24/7', re: /\b24\s?\/\s?7\b|\b24 hours a day\b/i },
  { phrase: 'free quotes', re: /\bfree\s+(quotes?|quotations?|estimates?)\b/i },
];

export const approvedSet = (cfg) =>
  new Set((cfg.approvedClaims || [])
    .filter((c) => c && typeof c.phrase === 'string' && typeof c.proof === 'string' && c.proof.trim().length >= 5)
    .map((c) => c.phrase.toLowerCase()));

export const findClaims = (text, approved) =>
  BANNED.filter((b) => b.re.test(text) && !approved.has(b.phrase.toLowerCase()));
