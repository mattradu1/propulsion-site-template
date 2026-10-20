# Master template v4 report (20 Oct 2026)
Status: v4.0.0 on branch `v4` (from `v3`), commit 3559347, local only. Nothing published or sent; no accounts used. `darren-reference/client.json` untouched (still templateVersion 2.0.0).

## Mobile first (primary target)
Local Lighthouse 12.8, mobile (412px, slow 4G, 4× CPU), home page, two runs each, v3 vs v4 back to back.

| Client | v3 LCP | v4 LCP (uncompressed) | v4 LCP (compressed, like a real host) | v3 compressed | Perf v4 | CLS v4 | TBT v4 |
|---|---|---|---|---|---|---|---|
| Test Roofing (B) | 1.97 / 1.98 s | 1.97 / 1.97 s | 1.51 / 1.53 s | 1.53 / 1.54 s | 99–100 | 0.000 | 0 ms |
| Test Bathrooms (C) | 1.98 / 1.99 s | 2.12 / 2.12 s | 1.51 / 1.51 s | 1.51 / 1.52 s | 99–100 | 0.000 | 0 ms |
| darren-reference (A) | 1.96 / 1.99 s | 1.81 / 1.96 s | 1.66 / 1.66 s | 1.66 / 1.67 s | 99–100 | 0.000 | 0 ms |

- Every page, all three clients: Performance 99–100, Accessibility 100, Best Practices 100, SEO 100 (darren-reference 66–69 because it is noindex on purpose).
- Gap: uncompressed, Test Bathrooms is +140 ms; compressed it matches v3. `SERVE_GZIP=1` added to the local server, off by default.
- darren `/work/` sometimes shows CLS 0.033 (timing race also in v3; under 0.1). Needs a real host.
- Phone checks at 360 / 390 / 414 px on every route: no sideways scroll; 44px targets; body and form fields 16px+ (no iOS zoom); right keyboard and autofill; action bar 48px buttons in thumb reach, safe-area padding, never over the form, closing band or footer; press feedback, no grey tap flash.
- Phone page weight (home, full scroll, uncompressed), v3 → v4: Test Roofing 172 → 174 KB; Test Bathrooms 218 → 225 KB; darren-reference 549 → 543 KB.

## 1 Design review panel (five lenses, methods not voices)
**(a) Brand and value.** (1) The site never said what happens after you enquire → `form.nextStep` in the client's words. (2) Boldness spread everywhere read as a template → one signature moment per client. (3) Same marks for every trade → trade motif: diamond (tile), ridge (roof), course (brick). (4) Reviews had weak hierarchy → one lead quote larger, platform named, reviewer's own rating only if in client.json. (5) Not fixed (copy calls for Matt): proof line and trust strip can repeat a fact; the hero says what and where but not what changes for the customer.

**(b) Interaction craft.** (1) No press feedback; hover stuck on phones; grey tap flash → `:active` scale .97 at 120 ms, hover only for fine pointers, tap highlight off. (2) 380 ms transitions on a weak curve → 120–240 ms strong ease-out. (3) Before/after snapped, jumped to the finger, misread second fingers and vertical scrolls, no momentum → interruptible critically damped spring, grab offset kept, one finger, release speed carried (capped ±12%); keyboard stays instant. (4) Hard cuts between pages → CSS View Transitions, header held still, zero JS. (5) 900 ms JS rise on every section → CSS scroll-driven, signature section only. (6) Count-up → opt-in.

**(c) Conversion for trades.** (1) No way to call or enquire mid-page on a phone → sticky action bar. (2) "Call" was a small text link → 48px primary button (or Enquire per client). (3) No WhatsApp route → opt-in, needs the number confirmed in writing, a source note and a privacy-page line, or the build fails. (4) Browser error bubbles, no next step → messages in place, focus to the first problem, success panel only where the processor is confirmed. (5) Kept: proof under hero, trust strip, reassurance before the form.

**(d) Accessibility and performance.** (1) No `viewport-fit=cover` / safe-area insets → added. (2) v3 bug: with JS off the process SVG drew a 1000px gold line down the page → static line is CSS per step. (3) Every client shipped every component → only what it uses (JS 3.3–11.0 KB, 1.2–3.8 KB compressed; CSS 27.8–31.8 KB). (4) Email field input hints added. (5) Reveals stay transform-only (opacity breaks contrast audits).

**(e) Frontend-design lens.** (1) Italic H1 phrase → opt-in, removed from demos. (2) Tracked caps/mono eyebrows everywhere → per variant: A keeps Darren's capitals; B and C quiet sentence case; mono only with `brand.labels: "mono"`. (3) Middle-dot meta strings removed. (4) Motion everywhere → one `signature`: beforeAfter, work or process. (5) Card hover deliberately not added (nothing is clickable). (6) Noted: Darren's look sits near two generic clusters but is his own judged-right design; "DEMO — example site" kept as Matt's words.

## 2 What changed
| # | Component | client.json | Notes |
|---|---|---|---|
| 1 | Phone action bar: Call · WhatsApp · Enquire | `actionBar`, `privacy.whatsapp` | Phones only; shown after the opening section, hidden near form/band/footer; 48px; safe-area; `tel:` E.164; no JS = not shown (hero/footer have the links) |
| 2 | Cross-page View Transitions | none | Only with motion allowed; zero JS |
| 3 | Scroll-driven reveal, one moment | `signature` | `@supports`, transform only, never on hero/H1 |
| 4 | Enquiry form | `form.nextStep`, `form.inlineSuccess` | In-place messages, 0px shift, focus to first problem; inline success only with `inlineSuccess: true` (keep off on real clients until the processor is tested) |
| 5 | Spring before/after + press states | none | ~25 lines of vanilla JS |
| 6 | Reviews | `reviews[].rating`, `reviews[].platform` | Word for word; rating whole 1–5 only as given; no aggregate |
| 7 | Sales demo mode | `--demo-mode`, `demo-reel.json`, `npm run demo` | "DEMO — example site" ribbon + trade switcher (ports 4201–4203); noindex; build and Gate A fail any non-DEMO client with demo mode |
| + | Quieter defaults | `hero.emphasis`, `hero.reveal`, `countUp`, `brand.labels`, `brand.motif` | Opt-in |
| + | Per-client CSS/JS | none | `@if` fences; comments stripped |

Demo clients updated (all values marked DEMO): Test Roofing (ridge motif, process signature, WhatsApp demo, next step, platforms); Test Bathrooms (before/after signature, Enquire-primary bar, inline success, ratings); Slate & Gutter (course motif, bar).

## 3 Weights
- JS (bytes / compressed) v3 → v4: Test Roofing 10.1/3.3 → 9.0/3.0 KB; Test Bathrooms 10.1/3.3 → 11.0/3.8 KB; darren-reference 10.1/3.3 → 3.3/1.2 KB.
- CSS 26.6 KB → 29.6 / 31.8 / 27.8 KB. Fonts unchanged.
- Desktop home: 174 → 176, 237 → 243, 617 → 612 KB.

## 4 QA (`npm run qa:all` exit 0)
- Guard tests 101/101 + 16/16 controls (48 guards; v3 84 + 13).
- Browser checks: Test Bathrooms 367/367, darren-reference 298/298, Test Roofing 317/317, at 360/390/414/768/834/1024/1280.
- Browser failure tests 15/15 + control.
- Gate A v1.4: 0 FAIL on all three at 360/390/414/1280 (action bar, demo-mode guard, VT/reveal rules, 16px fields). Gate A failure tests 6/6 + 3/3.
- axe 0 issues; routes 68/68; JSON-LD OK; demo server smoke test OK.

## 5 Rejected
Opacity reveals · reveals on every section · hover on non-clickable cards · a spring library · script-posting the form by default · aggregate ratings · review schema stars · action bar on tablet/desktop or without JS · thank-you page route (untested) · mono/italic/count-up by default · smooth scroll, WebGL, preloaders, new fonts, cookies, CDNs.

## 6 Needs testing
Action bar on a real iPhone and Android (home indicator, toolbar collapse, keyboard) · spring feel and slider on real touch screens · View Transitions (Chrome/Edge 126+, Safari 18.2+; Firefox instant) and scroll reveal (Chrome 115+, Safari 26) on devices · inline success with the real form processor · WhatsApp link on desktop and number formats · demo mode in a real screen-share · Lighthouse on a real host · from v3: screen readers on word-split H1 (opt-in), real before/after photos, test enquiry within 5 minutes, supplier-crop detection, Darren's PENDING items.

## 7 New template lines needing Matt's approval (`src/lines.mjs`)
"Quick contact" (screen readers) · "Enquire" · "WhatsApp" · "Add your name." · "Add an email address to reply to." · "Check the email address." · "Check the phone number." · "Tick the box so we/I can reply." · "Thank you. Your enquiry has been sent." · "Rated N out of 5" (screen readers) · "DEMO — example site" · "Other example trades" · a "WhatsApp" heading on the privacy page above the client's own sentence.

## 8 Decisions for Matt
1. Default bar primary: Call (as built) or Enquire.
2. Count-up off by default: confirm.
3. Variant A keeps Darren's capitals; B and C quiet: confirm.
4. Phone required on the form for phone-first trades? (Not changed: email required, phone optional.)
5. WhatsApp privacy line wording, when a client wants WhatsApp.
