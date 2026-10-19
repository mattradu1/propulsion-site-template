// Craft theme tokens (v2.0). Extracted from the Bathrooms Complete site (SiteDrop export, 21 Sep 2026)
// and held to the Website Build Standard: six type sizes, one spacing scale, one motion scale,
// no rounded corners or shadows unless a client token turns them on.
// Colours come from each client's brand.colors; everything else is fixed here.

export const THEME = 'craft';

// Six sizes, no more. Every font-size in theme.css is var(--fs-1) … var(--fs-6).
export const TYPE_SCALE = {
  'fs-1': '0.75rem',                                    // labels, eyebrows, captions (Darren: 11px, raised to 12px)
  'fs-2': '0.9375rem',                                  // nav, buttons, secondary text (Darren: 14–15px)
  'fs-3': 'clamp(1rem, 0.97rem + 0.15vw, 1.0625rem)',   // body (Darren: 16px phone, 17px desktop)
  'fs-4': 'clamp(1.25rem, 1.12rem + 0.55vw, 1.625rem)', // H3, quotes, wordmark, tagline (Darren: 20–26px)
  'fs-5': 'clamp(1.75rem, 1.5rem + 1.1vw, 2.375rem)',   // H2 (Darren: 28px phone, 38px desktop)
  'fs-6': 'clamp(2rem, 1.25rem + 3.2vw, 4rem)',         // H1 (Darren: 31–70px; capped at 64px)
};

export const LEADING = { tight: '1.18', snug: '1.3', quote: '1.5', body: '1.7' };
export const TRACKING = { label: '.12em', button: '.08em', heading: '-.01em' };

// Darren's spacing scale, unchanged (8 · 16 · 24 · 40 · 64 · 96 · 120), tightened on phones.
export const SPACE = { s1: '8px', s2: '16px', s3: '24px', s4: '40px', s5: '64px', s6: '96px', s7: '120px' };
export const SPACE_PHONE = { s5: '48px', s6: '56px', s7: '72px' };

export const LAYOUT = { max: '1440px', gutter: '64px', gutterTablet: '32px', gutterPhone: '24px', measure: '68ch', headerH: '72px', tap: '44px' };

// Motion: Darren's three speeds. All of it switches off under prefers-reduced-motion.
export const MOTION = { fast: '150ms', base: '380ms', slow: '900ms', ease: 'cubic-bezier(.4,0,.2,1)', rise: '24px' };

// Veils over photos. Text never sits on a photo with less than VEIL_MIN of the dark colour under it,
// so contrast is checked against the worst case: a pure white pixel under the veil.
export const VEIL_MIN = 0.8;

// Restraint: off unless the client's brand turns them on (brand.radius / brand.shadow).
export const RESTRAINT = { radius: '0', shadow: 'none' };

export const COLOR_KEYS = ['canvas', 'paper', 'line', 'ink', 'muted', 'accent', 'dark', 'onDark', 'onDarkMuted'];
export const COLOR_ROLES = {
  canvas: 'main page background',
  paper: 'alternate sections, trust strip, footer (variant A)',
  line: 'hairlines and image backgrounds (decorative only)',
  ink: 'body text and headings on canvas/paper',
  muted: 'secondary text, labels and eyebrows on canvas/paper',
  accent: 'rules, markers, button hover fill, text and outlines on dark',
  dark: 'scrolled nav, dark bands, evening mode, photo veils',
  onDark: 'text on dark',
  onDarkMuted: 'secondary text on dark',
};

// Default self-hosted fonts (@fontsource, SIL Open Font License 1.1). Max 2 families per site.
export const FONT_FILES = {
  'Playfair Display': { '400': 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2', '400i': 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2' },
  'Montserrat': { '400': 'node_modules/@fontsource/montserrat/files/montserrat-latin-400-normal.woff2', '500': 'node_modules/@fontsource/montserrat/files/montserrat-latin-500-normal.woff2' },
  'Source Serif 4': { '400': 'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2', '400i': 'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2' },
  'Inter': { '400': 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', '500': 'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2' },
};
export const FALLBACK = {
  serif: "'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif",
};
export const SERIF_FAMILIES = new Set(['Playfair Display', 'Source Serif 4']);

const rgb = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
// The colour a white pixel becomes under a veil of `hex` at opacity a (worst case for light text).
export const overWhite = (hex, a) => '#' + rgb(hex).map((c) => Math.round(c * a + 255 * (1 - a)).toString(16).padStart(2, '0')).join('');

export function tokensCss({ colors, fonts, radius, shadow }) {
  const c = colors;
  const q = (f) => `"${String(f).replace(/["\\;{}<>]/g, '')}"`;
  const fb = (f) => (SERIF_FAMILIES.has(f) ? FALLBACK.serif : FALLBACK.sans);
  const v = [
    ...Object.entries(TYPE_SCALE).map(([k, x]) => `--${k}:${x}`),
    ...Object.entries(LEADING).map(([k, x]) => `--lh-${k}:${x}`),
    ...Object.entries(TRACKING).map(([k, x]) => `--track-${k}:${x}`),
    ...Object.entries(SPACE).map(([k, x]) => `--${k}:${x}`),
    `--max:${LAYOUT.max}`, `--gutter:${LAYOUT.gutter}`, `--measure:${LAYOUT.measure}`, `--header-h:${LAYOUT.headerH}`, `--tap:${LAYOUT.tap}`,
    `--edge:max(var(--gutter),calc((100vw - var(--max))/2 + var(--gutter)))`,
    `--t-fast:${MOTION.fast}`, `--t-base:${MOTION.base}`, `--t-slow:${MOTION.slow}`, `--ease:${MOTION.ease}`, `--rise:${MOTION.rise}`,
    `--radius:${radius ?? RESTRAINT.radius}`, `--shadow:${shadow ?? RESTRAINT.shadow}`,
    `--canvas:${c.canvas}`, `--paper:${c.paper}`, `--line:${c.line}`, `--ink:${c.ink}`, `--muted:${c.muted}`, `--accent:${c.accent}`,
    `--dark:${c.dark}`, `--on-dark:${c.onDark}`, `--on-dark-muted:${c.onDarkMuted}`,
    `--veil:${rgba(c.dark, VEIL_MIN)}`, `--veil-strong:${rgba(c.dark, 0.9)}`,
    `--font-display:${q(fonts.display)},${fb(fonts.display)}`, `--font-text:${q(fonts.text)},${fb(fonts.text)}`,
    `--display-weight:${SERIF_FAMILIES.has(fonts.display) ? 400 : 500}`,
  ];
  return `:root{${v.join(';')}}\n@media (max-width:1099px){:root{--gutter:${LAYOUT.gutterTablet}}}\n@media (max-width:760px){:root{--gutter:${LAYOUT.gutterPhone};${Object.entries(SPACE_PHONE).map(([k, x]) => `--${k}:${x}`).join(';')}}}\n`;
}
