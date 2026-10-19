# Propulsion master website template (v1.0.0)

One `clients/<slug>/client.json` → one complete static site in `dist/<slug>/`, checked against OS-09 v2 every build.
Plain Node build script (no framework), sharp for images, self-hosted fonts, CSS compiled at build. Content never needs JavaScript; the only script is the day/evening toggle.

## How to start a new client in 10 steps
1. **Make the folder:** `mkdir -p clients/<slug>/images` and copy `clients/test-roofing/client.json` into it. Remove `"demo": true` and every DEMO value.
2. **Fill the facts from the record only** (Notion Pipeline Control and the client's own words): names, company number, phone, `gbpPhone` exactly as on Google, email, areas, domain, funnel URL, UTM. Anything not yet confirmed by the client: `{ "pending": "what is missing" }`. Never guess.
3. **Privacy fields:** registered address, ICO number (or `"not registered"`, or pending), last updated, form host, email host.
4. **Photos:** put the client's own files in `images/` (JPG/PNG/WebP only). Pick `layout`: `standard` needs 8+ usable photos including a finished job; otherwise `lowPhoto` with `hero.kind` `text` or `vanTeam`.
5. **Alt text** for every image, written from what the photo shows. Owner photo only with `photoConfirmed: true` (written yes on file).
6. **Reviews:** paste word for word with source URL. Any cut ends in "…" and has `truncated: true`. No reviews → leave the list empty; the section disappears.
7. **Brand:** colour tokens, fonts (max 2 families; custom fonts go in `clients/<slug>/fonts/` + `brand.fontFiles`), and a `variant` (A/B/C) not used by the same trade in the same area.
8. **Preview build:** `node build.mjs <slug> --preview`. Fix every FAIL (the message says what and where). AMBER items go in the preview email.
9. **QA:** `node scripts/axe.mjs <slug>`, `node scripts/gate-a.mjs <slug>`, `node scripts/check-jsonld.mjs dist/<slug>`, `node scripts/lighthouse.mjs <slug>` (after a live build). Then the manual items: test enquiry lands within 5 minutes, phone-width check by eye.
10. **Gate B / live build:** `node build.mjs <slug> --strict` (any PENDING item fails). Upload `dist/<slug>/` to the host only after Matt's go. Switch the form to the client's address only at Gate B.

## Commands
| Command | What it does |
|---|---|
| `node build.mjs <slug>` | Live build to `dist/<slug>/` |
| `node build.mjs <slug> --preview` | Preview build to `dist/<slug>--preview/`: banner, noindex meta + X-Robots-Tag, form to the test inbox |
| `node build.mjs <slug> --strict` | Gate B mode: pending markers fail |
| `--others <dir>` | Extra folder of other clients' `client.json` files for the cross-client check (all other `clients/*` are always checked) |
| `npm run test:guards` | Every deliberate-failure test (one broken config per guard) plus positive controls |
| `npm run qa:all` | Demo: build, JSON-LD, axe, Gate A, Lighthouse, guards |
| `node scripts/serve.mjs dist/<slug> 4173` | Local preview at 127.0.0.1 with host headers and a real 404 |
| `node scripts/gen-placeholders.mjs <slug>` | DEMO placeholder photos (sharp; fake GPS tags added to prove stripping) |

## Build guards (each fails the build)
G1 placeholders · G2 alt text · G3 contrast · G4 privacy fields · G5 funnel https + UTM · G6 phone vs Google · G7 image size caps · G8 GPS/camera metadata (exiftool) · G9 third-party CSS/fonts/Tailwind CDN · G10 review cuts · G11 owner photo · G12 sitemap/robots domain.
Engine rulebook additions: R1 unsafe content + CSP · R2 another client's phone/email/photos · R3 banned claims · R4 PENDING markers (amber, fail in `--strict`) · R5 preview mode · R6 layout eligibility · R7 variant clash.

## Layout
`build.mjs` (orchestrator) · `src/` (renderer, guards, images, contrast, claims) · `assets/` (template CSS/JS) · `clients/` (one folder per client) · `qa/qa-gate-a.js` (OS-09 Gate A browser script v1.1) · `scripts/` (serve, QA runners) · `tests/` (guard tests and fixtures) · `reports/` (QA output).

Requirements: Node 20+, `npm ci`, exiftool (`brew install exiftool` on the Mac). QA runners use the Playwright Chromium binary; set `CHROME_PATH` if it lives elsewhere.
