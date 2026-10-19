# Master template v2 report (19 Oct 2026)

**Status:** v2 is built on branch `v2`, local only. v1 is untouched on `master` at 1392483 (the repo's default branch is `master`, not `main`). Nothing was pushed, deployed or sent, and no accounts were used. The only network use was the npm install of two font packages.

## Scores (local Lighthouse 12.8, mobile, simulated throttling; axe-core 4.10 in Playwright Chromium)

| Client | Perf (home / worst page) | A11y | Best practices | SEO | LCP (home / worst) | CLS worst | axe (all levels, all pages, phone + desktop, live + preview) |
|---|---|---|---|---|---|---|---|
| Test Bathrooms Ltd (DEMO): craft C, standard | 100 / 99 | 100 | 100 | 100 | 1.6 s / 1.8 s | 0.000 | 0 issues (32 page-runs) |
| darren-reference (INTERNAL): craft A, lowPhoto | 99 / 99 | 100 | 100 | 66–69 as built; **100** without the deliberate noindex | 1.8 s / 2.1 s | 0.001 | 0 issues (28 page-runs) |
| Test Roofing Ltd (DEMO): craft B, standard | 100 / 99 | 100 | 100 | 100 | 1.5 s / 1.8 s | 0.047 (/work/) | 0 issues (28 page-runs) |

**darren-reference against Darren's 17 Oct preview:**
- Performance: 78 → 99
- Accessibility: 91 → 100
- SEO: 92 → 100, with the `is-crawlable` audit left out. That audit fails only because this internal build is noindex on purpose; as built the score is 66–69.
- LCP: 3.5 s → 1.8 s

This is not a like-for-like comparison. His figures came from PageSpeed on the live preview host; ours are from local Lighthouse with simulated throttling. The reference also uses one of his own rooms as the hero (a smaller file) instead of the supplier image his preview used. Re-run on a real host before quoting these numbers to anyone.

Other QA, all three clients, live and preview builds:
- **JSON-LD:** structure OK. darren-reference leaves out telephone and sameAs because both are PENDING.
- **Routes:** 68/68 (every route on direct request, no-slash redirects, old-site redirects, sitemap URLs, real 404).
- **Gate A:** 0 FAIL. darren-reference has 42 amber, which are its PENDING markers.
- **Browser checks:** 580/580 (390px overflow, 44px tap targets at 768/834/1024, computed fonts, six sizes or fewer, images load, copy phrases, phone menu, day/evening toggle).

## Guards
- **34 guards with deliberate-failure tests** (v1 had 19). All 71 failure tests pass, 12 of 12 controls pass, and the CLI exits 1 on a broken config.
- **7 browser-check failure tests** pass, plus a clean control.
- **New guards:** R8 internal reference · type scale · restraint tokens · design tokens · H1 trade + area · copy phrases · copy traceability · voice avoid words · headings in order · G13 routing · canonical · brief · Ideas page · supplier as own work · process image. All v1 guards are kept. The full list is in the README.
- **A real failure the static guards missed:** the browser check found the footer "Ideas" link was 40px wide at tablet width, which is Darren's exact failure. Every link now has a 44px minimum width.

## What was taken from Darren's design, and how
All of it lives as tokens in `themes/craft/tokens.mjs` plus `theme.css`. No Tailwind, no CDN.

1. **Palette as roles, not fixed colours.** His navy #0B1A29, gold #D6BE91, ivory #F7F3EA, stone #E8E2D7, warm grey #6E6253 and taupe #A99D8B became nine roles: canvas, paper, line, ink, muted, accent, dark, onDark, onDarkMuted.
   - Every colour pair the theme paints is contrast-checked before render.
   - That includes gold and ivory over a photo veil, tested against a pure white pixel. Darren's audit found 11 contrast failures.
2. **Hero:** his best finished room with the words on a veil, an italic serif tagline and a gold rule.
   - His strapline is kept as `tagline`, and the H1 now says what and where.
   - On phones the photo sits above the words on solid dark, so contrast never depends on the photo.
3. **Day/evening pairs** as one accessible toggle per work section.
   - It uses `role="group"` and `aria-pressed`. The whole section turns to evening, and alt text swaps via `aria-hidden`.
   - The toggle stays hidden until the script runs, so it never shows broken.
4. **Restraint and rhythm:**
   - square corners and no shadows (tokens, off by default)
   - his spacing scale (8/16/24/40/64/96/120)
   - uppercase tracked eyebrows, diamond markers and dividers
   - alternating half-photo story rows and a centred intro
   - the ivory trust strip moved directly under the hero
5. **Navigation and closing sections:**
   - a sticky header that turns navy on scroll, with a 3px gold progress line
   - a full-screen navy phone menu that holds focus and closes on Escape; without JS, "Menu" jumps to the footer links
   - a CTA band over a veiled evening photo and a four-column ivory footer
   - an Ideas masonry with every supplier image labelled, and a consultation page with three reassurances

**Type:** his roughly 18 font sizes became six tokens (12 / 15 / 16–17 / 20–26 / 28–38 / 32–64 px).

**Motion:** his three speeds (150 / 380 / 900 ms). Rise-into-view uses transform only, because opacity made axe fail on text not yet revealed. All motion stops under reduced motion.

**Variants inside the theme:**
- **A Atelier** (Darren): serif headings, veiled full-bleed hero, ivory footer.
- **B Workshop:** sans headings, split hero on paper, dark footer.
- **C Evening:** dark header, framed inset hero, dark reviews and footer.

Each variant gets its own hero crop, so no hero image is oversized.

## Fonts
- **Playfair Display** (display) and **Montserrat** (text). Both are SIL Open Font License 1.1, self-hosted from `@fontsource` 5.3.0, latin subset, four files of about 81 KB in total.
  - These are the two families embedded in Darren's own export CSS, so this is an exact match, not a lookalike.
  - His live preview loaded three families (Inter, Space Grotesk, Playfair) from Google. v2 caps it at two and checks this in the CSS and in the browser.
- Test Bathrooms uses Source Serif 4 + Montserrat. Test Roofing uses Source Serif 4 + Inter.

## Findings from Darren's export Matt should know (truth issues)
1. **The 21 Sep home page shows supplier images as Darren's work.**
   - The hero (922050a4833d) is supplier image 4910e08ac598, resized. The CTA banner (346541980989) is f7b3a5619b7d.
   - Three story images are crops of supplier images too (checked by eye).
   - Only the herringbone bathroom set (7 photos) is his own.
   - The new "supplier as own work" guard catches whole-image reuse and simple crops (distances 14 and 21 of 256; unrelated rooms score 56+). It does not catch partial-overlap crops; that needs testing, or the photo-origin question.
2. **Darren qualifies for the low-photo layout, but I kept a photo hero.** With 7 photos of his own work, the rulebook puts him in low-photo. I allowed a photo hero in low-photo when a finished job exists, because rulebook S2 only forces a text or van hero when there is none. **Matt to confirm this reading.**
3. **"Never shared" contradicts his privacy page.** The line "your details stay with us and go nowhere else" conflicts with the form host, email host and accountant listed there. Shown as PENDING.
4. **One review quote was cut without "…".** The home page's M Newson quote is the About-page review cut with a full stop. The reference uses the full text.
5. **His logo file is broken.** bc45073edf64.webp has lost its transparency: a gold bath outline in a black and yellow box. The reference uses a text wordmark.
6. **Banned comparison word.** "Still be the best room in the house" uses a banned comparison word. Shown as PENDING.

**PENDING markers on darren-reference.** They show visibly as "PENDING: …" because the build is internal:
- years in the trade
- team vs one pair of hands
- phone choice (07813 976959 vs 01494 582678)
- registered address and ICO
- legal name and company number
- funnel URL
- Google profile URL
- review source URLs
- project location
- evening-photo origin
- the "Never shared" line
- supplier image permission
- form endpoint and consent wording
- brief fields that were not in my inputs

## What still needs Matt
- **Approve the template's own lines** in `src/lines.mjs` (headings like "How a job runs", labels, neutral pending lines). They are the only words not taken from client.json, and the traceability guard trusts them.
- **Supplier image permission and supplier names** for the Ideas page labels.
- **Darren's real photos for the empty slots:**
  - a planning or setting-out photo for the process section
  - an owner portrait with his written yes
  - more finished rooms, to reach the standard layout
- **Darren's brand brief fields (17 Oct):** ideal client, buyer fears in review words, onliness, voice use/avoid. Without them his home page keeps the export's section order.
- **Darren's resolution of each PENDING conflict** above.
- **Still open from v1:** "best" allowed with proof vs the rulebook's "comparisons never used". v2 keeps v1 behaviour (fails unless approved with proof).
- **Pre-flight:** I did not check this week's dial count against the sell-before-build rule. The build was done as instructed.

## Needs testing
- Lighthouse and PageSpeed on a real host (and the Rich Results Test) before quoting any score.
- The test enquiry landing within 5 minutes. This needs the real test inbox; the preview inbox URL is still the example.com fixture.
- Partial-crop supplier detection (see finding 1).
- Whether Darren's evening shots are real lights-on photos, or level-2 restyles that need his written yes.
- How the real host handles `trailingSlash`, redirects and X-Robots-Tag. The local server only copies vercel.json.
- Human time from config to site with real photos (see BUILDLOG).

## Where things are
- `themes/craft/`: the design system.
- `clients/test-bathrooms`, `clients/test-roofing`, and `clients/slate-gutters` (the lowPhoto fixture).
- `clients/darren-reference`: INTERNAL only. Darren's 36 export images are committed in this local repo.
- `reports/`: axe, Gate A, browser, routes, JSON-LD, Lighthouse summaries and guard tests.
- `dist/`: not committed.
