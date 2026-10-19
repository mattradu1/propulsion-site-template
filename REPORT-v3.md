# Master template v3 report (19 Oct 2026)
Status: v3.0.0 on branch `v3` (from `v2`), local only, commit 0c15f7a. Nothing pushed, deployed, published or sent; no accounts used. `darren-reference` rebuilt locally only; its client.json untouched.

## What v3 adds (each switched on from client.json; missing or unproven data = component left out, never placeholder text)
1. **Before/after slider** (`beforeAfter.pairs`). From: Framer x-ray reveal + motion-pack slider. `clip-path: inset()` at the handle; keyboard slider (`role="slider"`, arrows, PgUp/PgDn, Home/End, `aria-valuenow`); mouse/pen/touch drag, vertical swipes still scroll. No-JS: both photos side by side, labelled. Shows only with `sameJob: true` + `source`, or on a DEMO client `demoImages: true` with a visible DEMO note.
2. **Hero word reveal.** From: motion pack (rise from blur, 90 ms stagger, ease-out-cubic, once); shader.se keeps real text. H1 split into words at build time, pure CSS, runs once; moves and blurs but never fades, so the H1 is visible from the first frame. Off under reduced motion.
3. **Italic emphasis** (`hero.emphasis`). From: parley. Must be an exact run of words in `hero.h1` or the build fails.
4. **Proof line under the hero** (`proofLine.items`). From: parley, minus its unproven "200+". Each fact needs `confirmed: true` + `source`; accreditations also need `proof` on file. Numbers exactly as given. Unconfirmed facts left out and flagged amber. Max 4.
5. **"How it works" line draw.** From: motion-pack process draw. SVG measured with `getTotalLength()`, drawn as steps scroll past; markers fill as reached. No-JS / reduced motion: fully drawn.
6. **Mono micro-labels.** From: oberon. System monospace, 0 KB downloaded.
7. **Large display type in the hero.** From: portavia, kaimarlow. Largest of the six sizes grows in the hero only: 34–96 px (variant A), 34–72 px (B, C).
8. **Count-up.** Only numbers written in client.json; final figure already in the HTML; runs once, no layout shift; `countUp: false` keeps it still.

## v2 bug found and fixed
Variant A with animation on: the slow hero zoom drew the photo over its dark overlay, and the overlay faded above 55% of hero height, so text could sit on a bare photo. Checks missed it (they run with reduced motion; axe can't measure contrast over images). Fix: overlay is part of the text block; every line sits on at least 80% overlay. Changes the look of darren-reference and slate-gutters: check by eye.

## Scores (local Lighthouse 12.8, mobile, simulated throttling; v2 → v3)
| Client | Perf home | Perf worst page | A11y / BP | SEO | LCP home | CLS worst |
|---|---|---|---|---|---|---|
| Test Bathrooms, C | 100 → 99 | 99 → 99 | 100 / 100 | 100 | 1.6 → 2.0 s | 0.000 → 0.002 |
| darren-reference, A | 99 → 98 | 99 → 98 | 100 / 100 | 66–69 (noindex on purpose; 100 without that audit) | 1.8 → 2.1 s | 0.001 → 0.000 |
| Test Roofing, B | 100 → 99 | 99 → 99 | 100 / 100 | 100 | 1.5 → 2.0 s | 0.047 → 0.002 |

Back-to-back on the same machine, Test Roofing LCP: v2 1.82 / 1.82 / 1.89 s; v3 1.83 / 1.82 / 2.04 s; Performance 99 every run. Real cost: about +65 ms blocking time.

## Weights (home, full scroll, uncompressed, phone / desktop)
| Client | v2 | v3 |
|---|---|---|
| Test Roofing | 161 / 163 KB | 172 / 174 KB |
| Test Bathrooms | 198 / 213 KB | 218 / 237 KB |
| darren-reference | 538 / 607 KB | 549 / 617 KB |
site.js 4.4 → 10.1 KB (3.4 KB gzipped), no libraries. site.css 21 → 26 KB. Fonts unchanged.

## QA
- Guard tests 84/84 (v2: 71) + 13/13 controls. New guards: hero emphasis, H1 server text, proof line, count-up, before/after, slider, reduced motion.
- Browser failure tests 10/10; browser checks 623/623 (reduced motion final state, slider drag + touch, JS off at 390px, motion runs once).
- Gate A v1.3: 0 FAIL on all three clients (no `[ ]`/`{{ }}` tokens, reduced-motion CSS, H1 in HTML, slider keyboard + ARIA).
- axe 0 issues; routes 68/68; JSON-LD OK.

## Rejected, and why
Preloaders/intro screens (slow first paint) · WebGL, distortion, smooth-scroll libraries (phone speed, accessibility) · pointer-following lens (no keyboard, awkward on touch) · fading words in (slows paint, breaks axe) · JS-written headlines · counting up derived figures · word rotators, sale pings, review shuffles, cursor tours, confetti, us-vs-them tables, invented counts · downloaded mono font · 120–264 px type, pill buttons, neon accents · "free" CTAs and on-page price ladder (banned / board item after 13 Nov) · scroll animation on every element.

## Known gaps / needs testing
- Screen readers on the word-split H1 (VoiceOver, NVDA): real-device test.
- No real client before/after photos yet; "same job" rests on the intake answer.
- Slider on real iOS Safari / Android.
- Count-up starts at 0 when on screen at load; `countUp: false` may be the better default for years in the trade.
- Proof line and trust strip can repeat a fact (copy call).
- Overlay fix changes variant A's look; check on a real host.
- darren-reference client.json still says templateVersion 2.0.0 (left untouched).
- Still open from v2: Lighthouse on a real host, test enquiry landing in 5 minutes, partial-crop supplier detection, Darren's PENDING items.
- Four new template lines need Matt's approval in `src/lines.mjs`: "Before and after", "Before", "After", "Before and after: move to compare".
