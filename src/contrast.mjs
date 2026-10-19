// WCAG 2.x contrast from hex colours, for every colour pair the craft theme paints.
import { overWhite, VEIL_MIN } from '../themes/craft/tokens.mjs';

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

// min 4.5 = normal text; 3 = focus rings, borders and large text. Darren's audit found 11 contrast failures:
// every pair below is checked before anything is rendered.
export const pairsFor = (c, variant) => {
  const veil = overWhite(c.dark, VEIL_MIN); // the lightest a photo can get under a veil
  const pairs = [
    { fg: 'ink', bg: 'canvas', where: 'body text and headings' },
    { fg: 'ink', bg: 'paper', where: 'text on alternate sections and the trust strip' },
    { fg: 'muted', bg: 'canvas', where: 'secondary text, eyebrows, toggle labels' },
    { fg: 'muted', bg: 'paper', where: 'secondary text on alternate sections and footer' },
    { fg: 'onDark', bg: 'dark', where: 'text on the dark nav, bands and evening mode' },
    { fg: 'onDarkMuted', bg: 'dark', where: 'secondary text on dark' },
    { fg: 'accent', bg: 'dark', where: 'buttons and tagline on dark' },
    { fg: 'dark', bg: 'accent', where: 'button hover and active day/evening label' },
    { fg: 'ink', bg: 'accent', where: 'button hover on light sections' },
    { fg: 'onDark', bg: 'veil', where: `text over a photo (veil ${VEIL_MIN} over a white pixel)`, bgHex: veil },
    { fg: 'accent', bg: 'veil', where: `tagline and button over a photo (veil ${VEIL_MIN} over a white pixel)`, bgHex: veil },
    { fg: 'ink', bg: 'canvas', where: 'focus ring on light', min: 3 },
    { fg: 'onDark', bg: 'dark', where: 'focus ring on dark', min: 3 },
  ];
  if (variant === 'B') pairs.push({ fg: 'ink', bg: 'paper', where: 'variant B hero on paper' });
  return pairs.map((p) => {
    const r = ratio(c[p.fg], p.bgHex || c[p.bg]);
    const min = p.min || 4.5;
    return { ...p, bgValue: p.bgHex || c[p.bg], ratio: Math.round(r * 100) / 100, min, ok: r >= min };
  });
};
