# Propulsion master website template (v4.0.0, craft theme)

One `clients/<slug>/client.json` → one complete static site in `dist/<slug>/`, checked on every build.
Plain Node build (no framework), sharp for images, two self-hosted font families at most (plus the system's own
monospace for micro-labels, never downloaded), CSS compiled from `themes/craft/` at build. Every word works without
JavaScript; the one deferred script adds the progress line, the phone menu, the day/evening toggle, the before/after
slider (spring-settled in v4), the process draw, count-up, and in v4 the phone action bar and the enquiry form's
messages. Scroll reveals and page transitions are pure CSS in v4.

v2 takes its look from the Bathrooms Complete site (Darren, SiteDrop export 21 Sep 2026) and keeps every v1
guard. v1 stays on the `master` branch (commit 1392483); v2 on `v2`; v3 on `v3` (motion and proof components, REPORT-v3.md).
v4 adds craft and conversion components and quieter defaults, mobile first (REPORT-v4: the file write was blocked in the build session, so its text was delivered in the agent reply; save it as REPORT-v4.md).

## v4 components and switches (all from client.json; missing data = not rendered, never placeholder text)
| Component | client.json | Rendered only when |
|---|---|---|
| Phone action bar (Call · WhatsApp · Enquire) | `actionBar: true` or `{ primary: "call" or "enquire", call, enquire, whatsapp: { number, confirmed: true, source } }`, plus `privacy.whatsapp` for WhatsApp | Phones only (<768px). site.js shows it after the opening section and hides it near the form, closing band and footer; inert when hidden. Call needs a confirmed phone; WhatsApp a confirmed +44 number, a source and a privacy line. No JS = never shown. |
| Form messages | none (always) | Approved lines already in the HTML, shown under the field by site.js; no JS = the browser's own checks. |
| What happens next | `form.nextStep` (client's words) | Under the Send button, and in the success panel. |
| Inline success panel | `form.inlineSuccess: true` | Only once the processor is confirmed to accept a script post (CORS preflight). Otherwise the browser posts as before. |
| Review rating, platform, lead quote | `reviews[].rating` (1–5 as given), `reviews[].platform` | Rating as motif shapes + screen-reader text; the first of two or more quotes is set larger. |
| One signature moment | `signature`: `beforeAfter`, `work`, `process` or `none` (default: the first that exists) | Only that section moves on its own (scroll-driven settle, the slider's one glide, or the process line). |
| Label style | `brand.labels`: `quiet`, `tracked` or `mono` | Default per variant: A tracked (Darren's capitals), B and C quiet sentence case. Mono only on request. |
| Trade motif | `brand.motif`: `diamond`, `ridge` or `course` | The marker shape (tile on point, roof ridge, bricks in bond). |
| Italic emphasis, word reveal, count-up | `hero.emphasis`, `hero.reveal: true`, proof item `countUp: true` | Off by default in v4 (opt-in). |
| View Transitions | none | Cross-page fade with the header held still; CSS only; off under reduced motion. |
| Sales demo mode | build flag `--demo-mode` + `demo-reel.json` | DEMO clients only (build and Gate A fail otherwise), noindex, `dist/<slug>--demo`. `npm run demo` serves the reel on ports 4201–4203. |

## v3 components (all opt-in from client.json; missing or unproven data = not rendered, never placeholder text)
| Component | client.json | Rendered only when |
|---|---|---|
| Hero word reveal | none (always on) | Always. Real H1 text in the HTML, one span per word; rises from a small blur, 90 ms apart, once. Off under reduced motion. |
| Italic emphasis in the H1 | `hero.emphasis` | It is an exact run of words already in `hero.h1` (else the build fails). |
| Proof line under the hero | `proofLine.items[]`: `{ "text" }` or `{ "value": 17, "label" }`, plus `source`, `confirmed: true`; accreditations add `kind: "accreditation"` and `proof` | Each item is confirmed with a source; accreditations have proof on file. Unconfirmed or pending items are left out (amber). Max 4. |
| Count-up | `value` on a proof item (a JSON number, as the client gave it); `"countUp": false` keeps it static | The final figure is in the HTML; JS counts up once when seen. Strings never count. |
| Before/after slider | `beforeAfter.pairs[]`: `before`, `after` (src + alt), `sameJob: true`, `source` | Real photos of one job from the client. A DEMO client may use `demoImages: true` with a visible `demoNote` containing DEMO. No JS = side by side. |
| Process draw | `process.steps` (existing) | Always with a process section. Line + diamonds drawn as the steps scroll past; fully drawn without JS or under reduced motion. |
| Mono micro-labels, large display hero | none | Always. Eyebrows, step numbers, proof line and labels use the system monospace; the hero's step-6 size grows to 96 px (variant A) / 72 px (B, C) on wide screens. |

## How to start a new client in 10 steps
1. **Folder:** `mkdir -p clients/<slug>/images`, copy `clients/test-bathrooms/client.json`, remove `"demo": true` and every DEMO value.
2. **Facts from the record only** (Notion Pipeline Control and the client's own words). Anything unconfirmed or in conflict: `{ "pending": "what is missing" }`. Never pick a value.
3. **Brand brief → `brief`:** idealClient, buyerFears (each with a word-for-word review `quote` and the section that answers it, `answeredBy`), onliness, archetype, voice use/avoid. Buyer fears set the home-page order; avoid words fail the build.
4. **Copy:** every visible sentence lives in client.json (`hero`, `intro`, `stories`, `process`, `copy`, `pages`). Missing → an approved neutral line from `src/lines.mjs`, or the section is left out. List the lines that must never drift in `copyPhrases`.
5. **H1** (`hero.h1`) names the trade and an area. A strapline goes in `hero.tagline`.
6. **Photos** in `images/` (JPG/PNG/WebP). `standard` needs 8+ of the client's own photos including a finished job; otherwise `lowPhoto`. The process image must show planning (`"shows": "planning"`). Supplier images go only in `pages.ideas.images` (12 max) and show only with `supplierImagesPermission: true`.
7. **Brand:** nine colour roles (`canvas, paper, line, ink, muted, accent, dark, onDark, onDarkMuted`), `fonts.display` + `fonts.text`, `variant` A/B/C not used by the same trade in the same area. Corners and shadows stay off unless `brand.radius` / `brand.shadow` turn them on.
8. **Preview build:** `node build.mjs <slug> --preview`. Fix every FAIL; AMBER items go in the preview email.
9. **QA:** `npm run qa:all` (or per client: `check-jsonld`, `routes`, `axe`, `gate-a`, `browser-checks`, `lighthouse`). Manual: test enquiry lands within 5 minutes.
10. **Gate B / live:** `node build.mjs <slug> --strict` (any PENDING fails; internal references are refused). Upload only after Matt's go.

## Commands
| Command | What it does |
|---|---|
| `node build.mjs <slug>` | Live build to `dist/<slug>/` |
| `node build.mjs <slug> --preview` | Preview: banner, noindex + X-Robots-Tag, form to the test inbox |
| `node build.mjs <slug> --strict` | Gate B: pending markers fail; `internalReference` clients refused |
| `node build.mjs <slug> --demo-mode` | v4 sales demo build (DEMO clients only): ribbon + trade switcher, noindex, `dist/<slug>--demo` |
| `npm run demo` | Builds and serves every demo-reel client on its own local port for screen-sharing |
| `npm run qa:gate-a-tests` | v4: deliberate-failure tests for the Gate A v1.4 checks |
| `npm run build:all` | Live + preview builds for every client |
| `npm run test:guards` | 84 deliberate-failure tests (one broken config or output per guard) + 13 controls |
| `npm run test:browser` | 10 deliberate-failure tests for the real-browser checks + control |
| `node scripts/weight.mjs <slug>` | Bytes a page really fetches after a full scroll, phone and desktop |
| `npm run qa:all` | Builds, JSON-LD, routes, axe, Gate A, browser checks, both test suites, Lighthouse |
| `node scripts/browser-checks.mjs <slug>` | 390px overflow, 44px tap targets at 768/834/1024, computed fonts, ≤6 sizes, images load, copy phrases, menu, toggle; v3: reduced-motion final state, slider drag + tap, JavaScript off at 390px, motion-on end state |
| `node scripts/routes.mjs <slug>` | Direct request of every route, no-slash redirects, old-site redirects, sitemap, real 404 |
| `node scripts/gen-placeholders.mjs <slug>` | DEMO placeholder photos (`demoScene`: roof or bathroom), fake GPS added to prove stripping |
| `node scripts/serve.mjs dist/<slug> 4173` | Local preview with host headers, redirects and a real 404 |

Lighthouse needs Chromium: `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (the scripts find it there by default).

## Guards (each fails the build)
v1: G1 placeholders · G2 alt text · G3 contrast · G4 privacy · G5 funnel + UTM · G6 phone vs Google · G7 image caps · G8 GPS/camera metadata · G9 third-party CSS/fonts · G10 review cuts · G11 owner photo · G12 sitemap/robots domain · R1 unsafe content + CSP · R2 cross-client · R3 banned claims · R4 PENDING · R5 preview · R6 layout · R7 variant.
v2: R8 internal reference never deployed · type scale (six sizes) · restraint tokens (corners, shadows) · design tokens (no colour literals) · H1 trade + area · copy phrases · copy traceability (no invented sentences) · voice avoid words · headings in order · G13 routing (every link and route resolves, no JS shell, redirects land) · canonical = final domain + own path · brief (fear quotes word for word) · Ideas page (12, labelled, lazy, permission) · supplier image passed off as own work (perceptual hash) · process image shows planning.
v3: Hero emphasis (exact H1 words) · H1 server text (word for word in the HTML) · Proof line (source, confirmed, accreditation proof, numbers as JSON numbers) · Count-up (only client numbers, final figure in HTML) · Before/after (same job + source, or labelled DEMO on a demo client) · Before/after slider (tabindex, aria-valuemin/max/now, label, two described photos) · Reduced motion (animating CSS must switch off; no smooth scroll).
Browser: 390px overflow · 44px tap targets at tablet widths · computed self-hosted fonts · ≤6 sizes in use · images load · copy phrases visible · phone menu · day/evening toggle · v3: reduced motion = final state · slider follows pointer and touch · no-JS fallback · motion runs once and lands.
v4: Action bar (WhatsApp confirmed + privacy line; Call = agreed number; hidden without JS) · Demo mode (DEMO only, never with --strict, noindex) · Form (no novalidate in HTML, every message present, right types + autocomplete, success panel only when confirmed) · Review rating (1–5 as given) · Signature · View transitions (only without reduced motion) · Scroll reveal (behind @supports + no-preference, never hero/H1, only inside the signature).
Browser v4: phones at 360/390/414 first · mobile type (16px+ body and fields, right keyboards) · action bar follows its rule at every half-screen · form messages, no shift, focus, success panel · View Transitions on/off · spring glides then lands.
Gate A v1.4 adds: four widths (360, 390, 414, 1280) · action bar never over form/band/footer, 44px targets in thumb reach, safe-area inset · demo mode FAILS on a non-DEMO client · VT/scroll-reveal rules · 16px fields with the right keyboard.
Gate A v1.3 adds: no `[ ]` / `{{ }}` tokens anywhere visible · reduced-motion CSS present · H1 text in the server HTML · slider keyboard + ARIA (and the photo follows).

## Layout
`build.mjs` · `themes/craft/` (tokens.mjs, theme.css, site.js) · `src/` (config, render, lines, brief, guards, images, contrast, claims) · `clients/` · `demo-reel.json` · `qa/qa-gate-a.js` (Gate A v1.4) · `scripts/` · `tests/` · `reports/`.

`clients/darren-reference` is INTERNAL ONLY: Darren's real copy and photos, noindex, footer marker, refused by `--strict`. Never deploy it.

Requirements: Node 20+, `npm ci`, exiftool.
