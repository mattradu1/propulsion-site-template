// Local JSON-LD structure check for every page in a build.
// Usage: node scripts/check-jsonld.mjs <distDir> [clientDir]
// Confirm in Google's Rich Results Test once the site is deployed: this is a structure check only.
import fs from 'node:fs';
import path from 'node:path';
import { listFiles } from '../src/guards-output.mjs';

const dir = path.resolve(process.argv[2] || 'dist/test-roofing');
const info = JSON.parse(fs.readFileSync(path.join(dir, 'build-info.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.resolve(process.argv[3] || `clients/${info.slug}`, 'client.json'), 'utf8'));
const LOCAL_BUSINESS_TYPES = new Set(['LocalBusiness', 'HomeAndConstructionBusiness', 'RoofingContractor', 'Plumber', 'Electrician', 'HVACBusiness', 'GeneralContractor', 'HousePainter', 'Locksmith', 'MovingCompany', 'AccountingService', 'MedicalClinic', 'Dentist', 'Physiotherapy', 'ProfessionalService']);
const errors = [];
const results = [];
for (const f of listFiles(dir).filter((x) => x.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const page = path.relative(dir, f);
  if (blocks.length !== 1) { errors.push(`${page}: expected 1 JSON-LD block, found ${blocks.length}`); continue; }
  let j;
  try { j = JSON.parse(blocks[0][1]); } catch (e) { errors.push(`${page}: JSON-LD is not valid JSON (${e.message})`); continue; }
  const e = (m) => errors.push(`${page}: ${m}`);
  if (j['@context'] !== 'https://schema.org') e('@context must be https://schema.org');
  if (!j['@type']) e('@type missing'); else if (!LOCAL_BUSINESS_TYPES.has(j['@type'])) e(`@type ${j['@type']} is not a known LocalBusiness subtype`);
  for (const k of ['name', 'telephone', 'email', 'url', 'areaServed', 'sameAs']) if (j[k] == null || (Array.isArray(j[k]) && !j[k].length)) e(`required field "${k}" missing`);
  if (j.name !== cfg.businessName) e('name does not match client.json businessName');
  if (j.telephone !== cfg.phoneE164) e('telephone does not match phoneE164');
  if (j.email !== cfg.email) e('email does not match');
  if (!String(j.url).startsWith(cfg.domain)) e('url is not the live domain');
  if (!j.sameAs?.includes(cfg.gbpUrl)) e('sameAs must include gbpUrl');
  if (cfg.addressPublic !== true && j.address) e('address present although addressPublic is false');
  if (cfg.addressPublic === true && !j.address) e('address missing although addressPublic is true');
  const areas = (j.areaServed || []).map((a) => a.name);
  if (areas.join('|') !== cfg.areasServed.join('|')) e('areaServed does not match areasServed');
  results.push({ page, type: j['@type'], fields: Object.keys(j) });
}
const report = { dir: path.relative(process.cwd(), dir), ok: errors.length === 0, pages: results.length, errors, results, note: "Structure check only. Confirm in Google's Rich Results Test once deployed." };
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(`reports/jsonld-${info.slug}.json`, JSON.stringify(report, null, 2));
console.log(errors.length ? 'JSON-LD FAIL\n' + errors.join('\n') : `JSON-LD OK: ${results.length} pages, @type ${results[0]?.type}, fields: ${results[0]?.fields.join(', ')}`);
process.exit(errors.length ? 1 : 0);
