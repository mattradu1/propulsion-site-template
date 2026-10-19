// WCAG 2.x contrast ratio from hex colours.
const lum = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`"${hex}" is not a 6-digit hex colour like #1a2b3c`);
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// The colour pairs the template actually paints, per variant.
// large: true = text 24px+ (or 19px bold), threshold 3:1; otherwise 4.5:1.
export const pairsFor = (c, variant) => {
  const pairs = [
    { fg: 'text', bg: 'background', where: 'body text' },
    { fg: 'muted', bg: 'background', where: 'secondary text' },
    { fg: 'accent', bg: 'background', where: 'links' },
    { fg: 'accentText', bg: 'accent', where: 'buttons and CTA band' },
    { fg: 'text', bg: 'surface', where: 'cards and alternate sections' },
    { fg: 'muted', bg: 'surface', where: 'secondary text on cards' },
    { fg: 'accent', bg: 'surface', where: 'links on cards' },
  ];
  if (variant === 'C') {
    pairs.push({ fg: 'background', bg: 'text', where: 'variant C dark hero and footer' });
    pairs.push({ fg: 'surface', bg: 'text', where: 'variant C secondary text on dark' });
  }
  if (variant === 'B') pairs.push({ fg: 'accent', bg: 'surface', where: 'variant B large headings', large: true });
  return pairs.map((p) => {
    const r = ratio(c[p.fg], c[p.bg]);
    const min = p.large ? 3 : 4.5;
    return { ...p, ratio: Math.round(r * 100) / 100, min, ok: r >= min };
  });
};
