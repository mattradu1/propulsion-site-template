// Safe HTML templating. Every interpolated value is escaped as plain text
// unless it is SafeHtml produced by this module. Client strings never become raw HTML.

export class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Only for markup the template itself writes. Never pass client data here.
export const raw = (s) => new SafeHtml(String(s));

const part = (v) => {
  if (v == null || v === false) return '';
  if (v instanceof SafeHtml) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
};

// Tagged template: h`<p>${clientText}</p>` escapes clientText.
export const h = (strings, ...vals) =>
  new SafeHtml(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));

// Attribute URL: only https:, tel:, mailto: or site-relative paths; anything else is dropped.
export const safeUrl = (u) => {
  const s = String(u ?? '').trim();
  if (/^(https:\/\/|tel:\+?[0-9]+$|mailto:[^\s<>"']+$|\/(?!\/)|#)/i.test(s)) return s;
  return '#unsafe-url-removed';
};
