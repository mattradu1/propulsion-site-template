// Deliberate-failure tests (v2): each case breaks one rule and proves the build FAILS with the right guard
// and a plain-English message. Positive controls prove good configs pass.
// Run: npm run test:guards   → prints a table, writes reports/guard-tests.json
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { build } from '../../build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TMP = path.join(ROOT, '.tmp', 'guards');
fs.rmSync(TMP, { recursive: true, force: true });
const read = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, `clients/${slug}/client.json`), 'utf8'));
const BASES = { roof: 'test-roofing', bath: 'test-bathrooms', darren: 'darren-reference' };
const fixtureOther = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/other-clients/other-roofer-marlow.json'), 'utf8'));
const DARREN_EXPORT = '/home/claude/build-inputs/darren-site/assets/img';

// Make a throwaway copy of a client, mutated by the case.
function client(id, mutate, base = 'roof') {
  const dir = path.join(TMP, id, 'client');
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(ROOT, `clients/${BASES[base]}/images`), path.join(dir, 'images'), { recursive: true });
  const cfg = structuredClone(read(BASES[base]));
  (mutate || (() => {}))(cfg, dir);
  fs.writeFileSync(path.join(dir, 'client.json'), JSON.stringify(cfg, null, 2));
  return dir;
}
function others(id, list) {
  const dir = path.join(TMP, id, 'others');
  fs.mkdirSync(dir, { recursive: true });
  list.forEach((o, i) => fs.writeFileSync(path.join(dir, `o${i}.json`), JSON.stringify(o)));
  return dir;
}
const B = (id, mutate, opts = {}, base = 'roof') => build({ clientDir: client(id, mutate, base), outDir: path.join(TMP, id, 'dist'), root: ROOT, ...opts });
// Build a good site, tamper with the output, then re-run only the output guards.
async function tamper(id, opts, fn, base = 'roof', mutate = null) {
  const clientDir = client(id, mutate, base);
  const outDir = path.join(TMP, id, 'dist');
  const first = await build({ clientDir, outDir, root: ROOT, ...opts });
  if (!first.ok) return first;
  await fn(outDir);
  return build({ clientDir, outDir, root: ROOT, checkOnly: true, ...opts });
}
const edit = (f, a, b) => { const s = fs.readFileSync(f, 'utf8'); const n = s.replace(a, b); if (n === s) throw new Error(`tamper did not apply in ${f}`); fs.writeFileSync(f, n); };
const css = (d) => path.join(d, 'assets/site.css');

const CASES = [
  // [id, guard expected, description, run]
  ['G1a', 'G1 Placeholders', 'Bracket placeholder left in copy', () => B('G1a', (c) => { c.hero.intro = 'We cover [LOCATION] and nearby.'; })],
  ['G1b', 'G1 Placeholders', '"TO BE SUPPLIED" in a service', () => B('G1b', (c) => { c.services[0].description = 'TO BE SUPPLIED'; })],
  ['G1c', 'G1 Placeholders', '"Location to be confirmed" as a project town (Darren\'s live page)', () => B('G1c', (c) => { c.projects[0].town = 'Location to be confirmed'; })],
  ['G2', 'G2 Alt text', 'Project image with empty alt', () => B('G2', (c) => { c.projects[0].pairs[0].day.alt = ''; })],
  ['G3a', 'G3 Contrast', 'Muted grey #9a9a9a on the canvas', () => B('G3a', (c) => { c.brand.colors.muted = '#9a9a9a'; })],
  ['G3b', 'G3 Contrast', 'Accent too dark to read on the dark bands and photo veils', () => B('G3b', (c) => { c.brand.colors.accent = '#5a6a7a'; })],
  ['G4', 'G4 Privacy', 'privacy.formHost empty', () => B('G4', (c) => { c.privacy.formHost = ''; })],
  ['G5a', 'G5 Funnel URL', 'funnelUrl is http://', () => B('G5a', (c) => { c.funnelUrl = 'http://funnel.example.com/test-roofing'; })],
  ['G5b', 'G5 Funnel URL', 'funnelUrl missing', () => B('G5b', (c) => { delete c.funnelUrl; })],
  ['G5c', 'G5 Funnel URL', 'funnelUrl is the literal [FUNNEL_URL] token (Darren\'s live CTAs)', () => B('G5c', (c) => { c.funnelUrl = '[FUNNEL_URL]'; })],
  ['G6', 'G6 Phone match', 'Site phone differs from GBP phone, no approval', () => B('G6', (c) => { c.gbpPhone = '01632 960999'; })],
  ['G7', 'G7 Image size', 'Hero is a noisy photo over the 200 KB cap', null],
  ['G8', 'G8 Image metadata', 'Metadata stripping disabled: GPS/camera tags reach /dist', () => build({ clientDir: client('G8'), outDir: path.join(TMP, 'G8', 'dist'), root: ROOT, keepMetadata: true })],
  ['G9a', 'G9 Third-party assets', 'Google Fonts CSS URL in brand config', () => B('G9a', (c) => { c.brand.fontCssUrl = 'https://fonts.googleapis.com/css2?family=Inter'; })],
  ['G9b', 'G9 Third-party assets', 'Tailwind Play CDN script injected into output', () => tamper('G9b', {}, (d) => edit(path.join(d, 'index.html'), '</head>', '<script src="https://cdn.tailwindcss.com"></script></head>'))],
  ['G9c', 'G9 Third-party assets', 'Three font families (Darren\'s preview had Inter, Space Grotesk, Playfair)', () => B('G9c', (c) => { c.brand.fonts.extra = 'Playfair Display'; })],
  ['G10a', 'G10 Review cuts', 'Review marked truncated without "…"', () => B('G10a', (c) => { c.reviews[2].truncated = true; })],
  ['G10b', 'G10 Review cuts', 'Review cut with a full stop and "…" removed (Darren\'s home page)', () => B('G10b', (c) => { c.reviews[1].text = c.reviews[1].text.replace(/…$/, '.'); })],
  ['G11', 'G11 Owner photo', 'Owner photo set but not confirmed', () => B('G11', (c) => { c.owner.photoConfirmed = false; })],
  ['G12a', 'G12 Sitemap/robots domain', 'domain is a preview host (*.vercel.app)', () => B('G12a', (c) => { c.domain = 'https://test-roofing-git-main.vercel.app'; })],
  ['G12b', 'G12 Sitemap/robots domain', 'sitemap.xml tampered to a preview URL', () => tamper('G12b', {}, (d) => edit(path.join(d, 'sitemap.xml'), /https:\/\/www\.test-roofing\.example/g, 'https://preview.sitedrop.example'))],
  ['R1a', 'R1 Unsafe content', '<script> in client copy', () => B('R1a', (c) => { c.hero.intro = 'Hello <script>alert(1)</script>'; })],
  ['R1b', 'R1 Unsafe content', 'javascript: link in client copy', () => B('R1b', (c) => { c.services[1].description = 'javascript:alert(1)'; })],
  ['R1c', 'R1 Unsafe content', 'onclick handler + iframe injected into output', () => tamper('R1c', {}, (d) => edit(path.join(d, 'about/index.html'), '<main id="main">', '<main id="main"><div onclick="x()"></div><iframe src="https://evil.example"></iframe>'))],
  ['R1d', 'R1 Unsafe content', 'Inline style attribute injected (Darren\'s pages used them)', () => tamper('R1d', {}, (d) => edit(path.join(d, 'index.html'), '<main id="main">', '<main id="main" style="color:red">'))],
  ['R2a', 'R2 Cross-client', "Another client's phone (slate-gutters) in copy", () => B('R2a', (c) => { c.process.steps[0].text = 'Call 01632 960987 to start.'; })],
  ['R2b', 'R2 Cross-client', "Another client's email as this client's email", () => B('R2b', (c) => { c.email = 'jo@slate-gutters.example'; })],
  ['R2c', 'R2 Cross-client', "Another client's photo reused (file fingerprint)", () => B('R2c', (c, dir) => { fs.copyFileSync(path.join(ROOT, 'clients/slate-gutters/images/g1-day.jpg'), path.join(dir, 'images/p4-day.jpg')); })],
  ['R2d', 'R2 Cross-client', 'Phone from a --others fixtures folder in copy', () => B('R2d', (c) => { c.services[0].description = 'Ring 01632 960555.'; }, { othersDir: others('R2d', [{ ...fixtureOther, variant: 'C' }]) })],
  ['R3a', 'R3 Banned claims', '"best" in hero copy, not approved', () => B('R3a', (c) => { c.hero.intro = 'The best roofers in the Chilterns.'; })],
  ['R3b', 'R3 Banned claims', '"24/7" approved without a proof note', () => B('R3b', (c) => { c.services[0].description = '24/7 emergency call-outs.'; c.approvedClaims = [{ phrase: '24/7', proof: '' }]; })],
  ['R3c', 'R3 Banned claims', '"Free quotes" in a process step', () => B('R3c', (c) => { c.process.steps[2].title = 'Free quotes'; })],
  ['R4', 'R4 PENDING marker', 'Strict (Gate B) build with ICO number still pending', () => B('R4', null, { strict: true })],
  ['R5a', 'R5 Preview mode', 'Preview build with no test inbox for the form', () => B('R5a', (c) => { delete c.preview; }, { preview: true })],
  ['R5b', 'R5 Preview mode', 'Preview banner removed from output', () => tamper('R5b', { preview: true }, (d) => edit(path.join(d, 'index.html'), /Preview – not live\./, 'Welcome.'))],
  ['R6', 'R6 Layout', 'Standard layout with only 5 photos', () => B('R6', (c) => { c.projects = c.projects.slice(0, 2); })],
  ['R7', 'R7 Variant', 'Same trade, same area, same variant as a fixture client', () => B('R7', null, { othersDir: others('R7', [fixtureOther]) })],
  ['R8a', 'R8 Internal reference', 'darren-reference built in Gate B / --strict mode (never deployed)', () => B('R8a', null, { strict: true }, 'darren')],
  ['R8b', 'R8 Internal reference', 'noindex stripped from an INTERNAL REFERENCE page', () => tamper('R8b', {}, (d) => edit(path.join(d, 'work/index.html'), '<meta name="robots" content="noindex, nofollow">', ''), 'darren')],
  // v2 additions
  ['TS1', 'Type scale', 'A seventh font size (13px) added to the CSS', () => tamper('TS1', {}, (d) => fs.appendFileSync(css(d), '.eyebrow{font-size:13px}'))],
  ['TS2', 'Type scale', 'A --fs-7 token added to :root', () => tamper('TS2', {}, (d) => edit(css(d), ':root{', ':root{--fs-7:5rem;'))],
  ['RS1', 'Restraint tokens', 'Rounded corners hard-coded (border-radius:8px)', () => tamper('RS1', {}, (d) => fs.appendFileSync(css(d), '.btn{border-radius:8px}'))],
  ['RS2', 'Restraint tokens', 'Drop shadow hard-coded on cards', () => tamper('RS2', {}, (d) => fs.appendFileSync(css(d), '.quote{box-shadow:0 6px 24px rgba(0,0,0,.2)}'))],
  ['RS3', 'Restraint tokens', 'brand.radius set to "50%" (not a small px token)', () => B('RS3', (c) => { c.brand.radius = '50%'; })],
  ['DT1', 'Design tokens', 'A colour literal painted outside the tokens', () => tamper('DT1', {}, (d) => fs.appendFileSync(css(d), '.hero{background:#ff0000}'))],
  ['H1a', 'H1 what/where', 'H1 says neither trade nor area ("Beautifully Considered. Expertly Installed.")', () => B('H1a', (c) => { c.hero.h1 = 'Beautifully Considered. Expertly Installed.'; c.copyPhrases = []; })],
  ['H1b', 'H1 what/where', 'H1 names the trade but no area', () => B('H1b', (c) => { c.hero.h1 = 'Roof repairs and new roofs'; c.copyPhrases = []; })],
  ['H1c', 'H1 what/where', 'Rendered H1 tampered after build', () => tamper('H1c', {}, (d) => edit(path.join(d, 'index.html'), /<h1 id="hero-h">[\s\S]*?<\/h1>/, '<h1 id="hero-h">Quality you can trust</h1>'))],
  ['CP1', 'Copy phrases', 'Copy-phrase list holds a line that is not in the client copy', () => B('CP1', (c) => { c.copyPhrases.push('Unrivalled craftsmanship'); })],
  ['CP2', 'Copy phrases', 'Approved line drifted on the built page', () => tamper('CP2', {}, (d) => edit(path.join(d, 'ideas/index.html'), 'DEMO: These are supplier images, not my own projects.', 'DEMO: Images from our suppliers.'), 'bath')],
  ['TR1', 'Copy traceability', 'Invented sentence in the output ("Reliable, tidy, family-run.")', () => tamper('TR1', {}, (d) => edit(path.join(d, 'about/index.html'), '</main>', '<p>Reliable, tidy, family-run.</p></main>'))],
  ['VO1', 'Voice', 'Brief voice.avoid word ("luxury") used in the copy', () => B('VO1', (c) => { c.hero.intro = 'DEMO copy: luxury bathrooms, drawn to scale.'; }, {}, 'bath')],
  ['HD1', 'Headings in order', 'An H2 placed before the H1', () => tamper('HD1', {}, (d) => edit(path.join(d, 'work/index.html'), '<main id="main">', '<main id="main"><h2>DEMO: Our work</h2>'), 'bath')],
  ['HD2', 'Headings in order', 'Heading jumps H1 → H3 (Darren\'s consultation page)', () => tamper('HD2', {}, (d) => edit(path.join(d, 'consultation/index.html'), /<h2 class="h-small">/g, '<h3 class="h-small">'), 'bath')],
  ['RT1', 'G13 Routing', 'A page deleted while links still point at it (sub-path 404)', () => tamper('RT1', {}, (d) => fs.rmSync(path.join(d, 'about/index.html')))],
  ['RT2', 'G13 Routing', 'Old-site redirect lands on a page that does not exist', () => B('RT2', (c) => { c.redirects = [{ from: '/our-work.html', to: '/portfolio/' }]; }, {}, 'bath')],
  ['RT3', 'G13 Routing', 'Story links to a page that is switched off', () => B('RT3', (c) => { c.pages.about = false; }, {}, 'bath')],
  ['RT4', 'G13 Routing', 'Route replaced by an empty JavaScript shell', () => tamper('RT4', {}, (d) => edit(path.join(d, 'services/index.html'), /<main id="main">[\s\S]*<\/main>/, '<main id="main"><div id="app"></div></main>'))],
  ['CA1', 'Canonical', 'Inner page canonical points at the home page', () => tamper('CA1', {}, (d) => edit(path.join(d, 'work/index.html'), '<link rel="canonical" href="https://www.test-roofing.example/work/">', '<link rel="canonical" href="https://www.test-roofing.example/">'))],
  ['CA2', 'Canonical', 'Canonical points at a preview host', () => tamper('CA2', {}, (d) => edit(path.join(d, 'about/index.html'), '<link rel="canonical" href="https://www.test-roofing.example/about/">', '<link rel="canonical" href="https://demo.vercel.app/about/">'))],
  ['BR1', 'Brief', 'Buyer-fear quote is not word for word from the review', () => B('BR1', (c) => { c.brief.buyerFears[0].quote = 'kept everything really clean'; }, {}, 'bath')],
  ['BR2', 'Brief', 'Buyer fear answered by a section that does not exist', () => B('BR2', (c) => { c.brief.buyerFears[0].answeredBy = 'faq'; }, {}, 'bath')],
  ['BR3', 'Brief', 'Archetype not one of the twelve ("Luxury")', () => B('BR3', (c) => { c.brief.archetype = 'Luxury'; }, {}, 'bath')],
  ['ID1', 'Ideas page', '13 supplier images listed (limit 12)', () => B('ID1', (c) => { const im = c.pages.ideas.images; while (im.length < 13) im.push({ ...im[0] }); }, {}, 'bath')],
  ['ID2', 'Ideas page', 'Supplier image label removed from the output', () => tamper('ID2', {}, (d) => edit(path.join(d, 'ideas/index.html'), '<figcaption><span>Supplier image</span>', '<figcaption><span>Our project</span>'), 'bath')],
  ['ID3', 'Ideas page', 'Supplier image not lazy-loaded', () => tamper('ID3', {}, (d) => edit(path.join(d, 'ideas/index.html'), /(<figure class="supplier"><img[^>]*?) loading="lazy"/, '$1'), 'bath')],
  ['ID4', 'Ideas page', 'Supplier images shown on the home page', () => tamper('ID4', {}, (d) => { const fig = fs.readFileSync(path.join(d, 'ideas/index.html'), 'utf8').match(/<figure class="supplier">[\s\S]*?<\/figure>/)[0]; edit(path.join(d, 'index.html'), '</main>', fig + '</main>'); }, 'bath')],
  ['ID5', 'Ideas page', 'Supplier images listed with no "not our work" disclaimer', () => B('ID5', (c) => { delete c.pages.ideas.disclaimer; c.copyPhrases = c.copyPhrases.filter((p) => !String(p.phrase || p).includes('supplier')); }, {}, 'bath')],
  ['SO1', 'Supplier as own work', 'A supplier image used as a story photo', () => B('SO1', (c) => { c.stories[0].image.src = 'sup-2.jpg'; }, {}, 'bath')],
  ['SO2', 'Supplier as own work', "Darren's 21 Sep hero: a resized supplier photo passed off as his own room", null],
  ['PI1', 'Process image', 'Process image shows a finished room, not planning', () => B('PI1', (c) => { c.process.image.shows = 'finished'; }, {}, 'bath')],
  // v3 additions
  ['HE1', 'Hero emphasis', 'Italic emphasis phrase that is not in the H1 ("brand new roofs")', () => B('HE1', (c) => { c.hero.emphasis = 'brand new roofs'; })],
  ['HS1', 'H1 server text', 'H1 words reordered in the HTML (not the approved line word for word)', () => tamper('HS1', {}, (d) => edit(path.join(d, 'index.html'), /<h1 id="hero-h">[\s\S]*?<\/h1>/, '<h1 id="hero-h">New roofs and roof repairs in High Wycombe</h1>'))],
  ['PL1', 'Proof line', 'Years trading written as a string ("17+") instead of the figure as given', () => B('PL1', (c) => { c.proofLine.items[0].value = '17+'; })],
  ['PL2', 'Proof line', 'Accreditation in the proof line with no proof on file', () => B('PL2', (c) => { delete c.proofLine.items[1].proof; })],
  ['PL3', 'Proof line', 'Proof-line fact with no source note', () => B('PL3', (c) => { delete c.proofLine.items[0].source; })],
  ['CU1', 'Count-up', 'Counter tampered to count to a number not in client.json (250)', () => tamper('CU1', {}, (d) => edit(path.join(d, 'index.html'), 'data-count="17">17<', 'data-count="250">250<'), 'roof', countOn)],
  ['CU2', 'Count-up', 'Counter starts at 0 in the HTML (final figure only written by JavaScript)', () => tamper('CU2', {}, (d) => edit(path.join(d, 'index.html'), 'data-count="17">17<', 'data-count="17">0<'), 'roof', countOn)],
  ['BA1', 'Before/after', 'Before/after pair not marked as the same job, with no source', () => B('BA1', (c) => { delete c.beforeAfter.pairs[0].demoImages; }, {}, 'bath')],
  ['BA2', 'Before/after', 'Demo images on a client that is not a DEMO client', () => B('BA2', (c) => { c.demo = false; }, {}, 'bath')],
  ['BA3', 'Before/after', 'Same photo used for before and after', () => B('BA3', (c) => { c.beforeAfter.pairs[0].after.src = c.beforeAfter.pairs[0].before.src; }, {}, 'bath')],
  ['BS1', 'Before/after slider', 'Slider loses its keyboard focus and value (tabindex, aria-valuenow removed)', () => tamper('BS1', {}, (d) => edit(path.join(d, 'index.html'), ' tabindex="0" aria-label="Before and after: move to compare" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"', ' aria-label="Before and after: move to compare"'), 'bath')],
  ['RM1', 'Reduced motion', 'Reduced-motion block removed from the CSS', () => tamper('RM1', {}, (d) => edit(css(d), /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important\}/, '@media (min-width:1px){*{}'))],
  ['RM2', 'Reduced motion', 'Smooth-scroll behaviour added to the CSS', () => tamper('RM2', {}, (d) => fs.appendFileSync(css(d), 'html{scroll-behavior:smooth}'))],
  // v4 additions
  ['AB1', 'Action bar', 'WhatsApp in the action bar without the client confirming the number', () => B('AB1', (c) => { delete c.actionBar.whatsapp.confirmed; })],
  ['AB2', 'Action bar', 'WhatsApp link with no privacy-page line (UK GDPR: every channel named)', () => B('AB2', (c) => { delete c.privacy.whatsapp; })],
  ['AB3', 'Action bar', "Action bar's Call button tampered to ring another number", () => tamper('AB3', {}, (d) => edit(path.join(d, 'index.html'), /(<nav class="actionbar"[\s\S]*?href="tel:)\+441632960123/, '$1+441632960999'))],
  ['AB4', 'Action bar', 'Action bar shown without JavaScript (hidden attribute removed)', () => tamper('AB4', {}, (d) => edit(path.join(d, 'index.html'), 'data-actionbar hidden>', 'data-actionbar>'))],
  ['DM1', 'Demo mode', 'Sales demo mode on a real (non-DEMO) client: darren-reference', () => B('DM1', null, { demoMode: true }, 'darren')],
  ['DM2', 'Demo mode', 'Demo mode combined with a Gate B (--strict) build', () => B('DM2', (c) => { c.privacy.icoNumber = 'not registered (DEMO)'; }, { demoMode: true, strict: true })],
  ['DM3', 'Demo mode', 'Demo ribbon pasted into a real client build (darren-reference preview)', () => tamper('DM3', { preview: true }, (d) => edit(path.join(d, 'index.html'), '<a class="skip" href="#main">Skip to content</a>', '<a class="skip" href="#main">Skip to content</a><div class="demo-ribbon" data-demo-ribbon><p><strong>DEMO — example site</strong></p></div>'), 'darren')],
  ['VT1', 'View transitions', '@view-transition switched on for everyone (outside the no-preference block)', () => tamper('VT1', {}, (d) => fs.appendFileSync(css(d), '@view-transition{navigation:auto}'))],
  ['SR1', 'Scroll reveal', 'Scroll-driven animation put on the hero photo (the LCP element)', () => tamper('SR1', {}, (d) => fs.appendFileSync(css(d), '@supports (animation-timeline:view()){@media (prefers-reduced-motion:no-preference){.sig .hero-media img{animation:riseIn linear both;animation-timeline:view()}}}'))],
  ['SR2', 'Scroll reveal', 'Scroll reveal on every section, not one signature moment', () => tamper('SR2', {}, (d) => fs.appendFileSync(css(d), '@supports (animation-timeline:view()){@media (prefers-reduced-motion:no-preference){.rise{animation:riseIn linear both;animation-timeline:view()}}}'))],
  ['SR3', 'Scroll reveal', 'Scroll-driven animation with no @supports / reduced-motion guard', () => tamper('SR3', {}, (d) => fs.appendFileSync(css(d), '.sig .rise{animation-timeline:view()}'))],
  ['FM1', 'Form', 'Enquiry form marked novalidate in the HTML (no-JS visitors lose the checks)', () => tamper('FM1', {}, (d) => edit(path.join(d, 'consultation/index.html'), '<form method="post"', '<form novalidate method="post"'))],
  ['FM2', 'Form', 'Email field type changed to text (wrong phone keyboard, no autofill)', () => tamper('FM2', {}, (d) => edit(path.join(d, 'consultation/index.html'), 'name="email" type="email"', 'name="email" type="text"'))],
  ['FM3', 'Form', 'form.nextStep is an empty string (no invented "we\'ll be in touch")', () => B('FM3', (c) => { c.form.nextStep = ' '; })],
  ['FM4', 'Form', 'Success panel in the HTML without inlineSuccess confirmed', () => tamper('FM4', {}, (d) => edit(path.join(d, 'consultation/index.html'), '</form>', '</form><div class="sent" hidden><h3>Thank you. Your enquiry has been sent.</h3></div>'))],
  ['RR1', 'Review rating', 'Review rating written as an average (4.8)', () => B('RR1', (c) => { c.reviews[0].rating = 4.8; }, {}, 'bath')],
  ['SG1', 'Signature', 'Signature set to a section that cannot be the one moving moment ("hero")', () => B('SG1', (c) => { c.signature = 'hero'; })],
];
const countOn = (c) => { c.proofLine.items[0].countUp = true; };
// G7 needs a real oversized image: replace the hero with gaussian noise.
CASES.find((c) => c[0] === 'G7')[3] = async () => {
  const dir = client('G7');
  await sharp({ create: { width: 2400, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 70 } } }).jpeg({ quality: 95 }).toFile(path.join(dir, 'images/hero.jpg'));
  return build({ clientDir: dir, outDir: path.join(TMP, 'G7', 'dist'), root: ROOT });
};
// SO2 uses the real case from Darren's export: hero 922050a4833d is supplier image 4910e08ac598, resized.
CASES.find((c) => c[0] === 'SO2')[3] = async () => {
  const dir = client('SO2', (c) => { c.hero.image.src = 'darren-hero-922050a4833d.webp'; c.pages.ideas.images[0].src = 'darren-supplier-4910e08ac598.webp'; }, 'bath');
  fs.copyFileSync(path.join(DARREN_EXPORT, '922050a4833d.webp'), path.join(dir, 'images/darren-hero-922050a4833d.webp'));
  fs.copyFileSync(path.join(DARREN_EXPORT, '4910e08ac598.webp'), path.join(dir, 'images/darren-supplier-4910e08ac598.webp'));
  return build({ clientDir: dir, outDir: path.join(TMP, 'SO2', 'dist'), root: ROOT });
};

const CONTROLS = [
  ['OK1', 'Test Roofing, live build (pending ICO = amber only)', () => B('OK1')],
  ['OK2', 'Test Roofing, preview build', () => B('OK2', null, { preview: true })],
  ['OK3', 'Approved claim with proof note is allowed', () => B('OK3', (c) => { c.services[0].description = '24/7 emergency call-outs.'; c.approvedClaims = [{ phrase: '24/7', proof: 'Client written terms, Drive/Clients/DEMO/terms.pdf (DEMO)' }]; })],
  ['OK4', 'Phone mismatch with a written approval reason', () => B('OK4', (c) => { c.gbpPhone = '01632 960999'; c.phoneMismatchApproved = 'GBP being updated by client (DEMO)'; })],
  ['OK5', 'Client text with HTML is escaped, never rendered', null],
  ['OK6', 'Slate & Gutter (lowPhoto layout, text hero, variant A) builds', () => build({ slug: 'slate-gutters', outDir: path.join(TMP, 'OK6', 'dist'), root: ROOT })],
  ['OK7', 'Test Bathrooms (craft C, standard, brief-ordered) live build', () => B('OK7', null, {}, 'bath')],
  ['OK8', 'darren-reference live build (internal, PENDING = amber)', () => B('OK8', null, {}, 'darren')],
  ['OK9', 'darren-reference preview build', () => B('OK9', null, { preview: true }, 'darren')],
  ['OK10', 'Buyer fears reorder the home page (process, owner, design story first)', null],
  ['OK11', 'Supplier images left out (not failed) when permission is false', null],
  ['OK12', 'Unconfirmed proof-line fact is left out (amber), not shown', null],
  ['OK13', 'Test Roofing in sales demo mode (ribbon, switcher, noindex)', null],
  ['OK14', 'Quiet defaults: no italic emphasis, no word split, no count-up unless switched on', null],
  ['OK15', 'One signature section per page (Test Bathrooms: the before/after)', null],
];
CONTROLS.find((c) => c[0] === 'OK5')[2] = async () => {
  const r = await B('OK5', (c) => { c.services[0].description = 'Tiles & slates <b>bold</b>'; });
  const html = fs.readFileSync(path.join(TMP, 'OK5', 'dist', 'index.html'), 'utf8');
  if (!html.includes('Tiles &amp; slates &lt;b&gt;bold&lt;/b&gt;')) r.ok = false, r.problems.push({ level: 'fail', guard: 'Escape', msg: 'client HTML was not escaped' });
  return r;
};
CONTROLS.find((c) => c[0] === 'OK10')[2] = async () => {
  const r = await B('OK10', null, {}, 'bath');
  const order = JSON.parse(fs.readFileSync(path.join(TMP, 'OK10', 'dist', 'build-info.json'), 'utf8')).homeOrder;
  if (order.slice(0, 4).join(',') !== 'intro,process,owner,story:design') r.ok = false, r.problems.push({ level: 'fail', guard: 'Brief', msg: `home order ${order.join(', ')}` });
  return r;
};
CONTROLS.find((c) => c[0] === 'OK11')[2] = async () => {
  const r = await B('OK11', (c) => { c.supplierImagesPermission = false; c.copyPhrases = c.copyPhrases.filter((p) => !String(p.phrase || p).includes('supplier')); }, {}, 'bath');
  const html = fs.readFileSync(path.join(TMP, 'OK11', 'dist', 'ideas/index.html'), 'utf8');
  if (/class="supplier"/.test(html) || fs.readdirSync(path.join(TMP, 'OK11', 'dist', 'assets/img')).some((f) => /-thumb-/.test(f))) r.ok = false, r.problems.push({ level: 'fail', guard: 'Ideas page', msg: 'supplier images still built' });
  return r;
};
CONTROLS.find((c) => c[0] === 'OK12')[2] = async () => {
  const r = await B('OK12', (c) => { c.proofLine.items[1].confirmed = false; });
  const html = fs.readFileSync(path.join(TMP, 'OK12', 'dist', 'index.html'), 'utf8');
  if (/demo trade body/.test(html) || !r.problems.some((p) => p.guard === 'Proof line' && p.level === 'amber')) r.ok = false, r.problems.push({ level: 'fail', guard: 'Proof line', msg: 'unconfirmed fact still shown or not flagged' });
  return r;
};

CONTROLS.find((c) => c[0] === 'OK13')[2] = async () => {
  const r = await B('OK13', null, { demoMode: true });
  const html = fs.readFileSync(path.join(TMP, 'OK13', 'dist', 'index.html'), 'utf8');
  if (!/data-demo-mode="on"/.test(html) || !html.includes('DEMO — example site') || !/noindex/.test(html) || !html.includes('href="http://localhost:4202/"')) r.ok = false, r.problems.push({ level: 'fail', guard: 'Demo mode', msg: 'ribbon, switcher or noindex missing' });
  return r;
};
CONTROLS.find((c) => c[0] === 'OK14')[2] = async () => {
  const r = await B('OK14');
  const html = fs.readFileSync(path.join(TMP, 'OK14', 'dist', 'index.html'), 'utf8');
  const h1 = html.match(/<h1 id="hero-h">([\s\S]*?)<\/h1>/)[1];
  if (/<em>|class="w /.test(h1) || /data-count=/.test(html) || /labels-quiet/.test(html) === false) r.ok = false, r.problems.push({ level: 'fail', guard: 'Defaults', msg: `h1 ${h1.slice(0, 80)}; count ${/data-count=/.test(html)}` });
  return r;
};
CONTROLS.find((c) => c[0] === 'OK15')[2] = async () => {
  const r = await B('OK15', null, {}, 'bath');
  const html = fs.readFileSync(path.join(TMP, 'OK15', 'dist', 'index.html'), 'utf8');
  const sigs = html.match(/class="section [^"]*\bsig\b/g) || [];
  if (sigs.length !== 1 || !/ba-section sig/.test(html) || /data-draw/.test(html)) r.ok = false, r.problems.push({ level: 'fail', guard: 'Signature', msg: `${sigs.length} signature sections` });
  return r;
};
const rows = [];
for (const [id, guard, desc, run] of CASES) {
  let r;
  try { r = await run(); } catch (e) { r = { ok: true, problems: [{ level: 'fail', guard: 'Test harness', msg: e.message }] }; }
  const hit = r.problems.find((p) => p.level === 'fail' && p.guard === guard);
  const pass = !r.ok && !!hit;
  rows.push({ id, guard, test: desc, expected: 'build fails', result: pass ? 'PASS' : 'FAIL', message: hit?.msg || `(no ${guard} failure; got: ${r.problems.filter((p) => p.level === 'fail').map((p) => p.guard + ': ' + p.msg).join(' | ') || 'build passed'})` });
}
for (const [id, desc, run] of CONTROLS) {
  const r = await run();
  rows.push({ id, guard: 'Control', test: desc, expected: 'build passes', result: r.ok ? 'PASS' : 'FAIL', message: r.ok ? `ok${r.problems.length ? ' (amber: ' + [...new Set(r.problems.map((p) => p.guard))].join(', ') + ')' : ''}` : r.problems.filter((p) => p.level === 'fail').map((p) => p.guard + ': ' + p.msg).join(' | ') });
}
// CLI exit code: the real command exits 1 on a broken config.
let exit = 0;
try { execFileSync('node', ['build.mjs', '--client-dir', path.join(TMP, 'G6', 'client'), '--out', path.join(TMP, 'G6', 'cli'), '--quiet'], { cwd: ROOT, stdio: 'ignore' }); } catch (e) { exit = e.status; }
rows.push({ id: 'CLI', guard: 'Control', test: 'node build.mjs exits non-zero on a broken config', expected: 'exit 1', result: exit === 1 ? 'PASS' : 'FAIL', message: `exit ${exit}` });

const failed = rows.filter((r) => r.result !== 'PASS');
for (const r of rows) console.log(`${r.result.padEnd(4)} ${r.id.padEnd(5)} ${r.guard.padEnd(26)} ${r.test}\n           → ${r.message.slice(0, 300)}`);
const caseRows = rows.filter((r) => r.guard !== 'Control');
const ctrl = rows.filter((r) => r.guard === 'Control');
console.log(`\nDeliberate-failure tests: ${caseRows.filter((r) => r.result === 'PASS').length}/${caseRows.length} pass · controls: ${ctrl.filter((r) => r.result === 'PASS').length}/${ctrl.length} pass · guards covered: ${new Set(caseRows.map((r) => r.guard)).size}`);
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/guard-tests.json'), JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
