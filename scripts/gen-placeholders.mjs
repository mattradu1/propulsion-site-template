// Generates DEMO placeholder photos locally with sharp (no stock downloads, never a real client's photos).
// Usage: node scripts/gen-placeholders.mjs <slug>
// client.json "demoScene": "roof" (default) or "bathroom". Each source JPEG gets fake camera + GPS tags
// (via exiftool when installed) so the build's metadata stripping and the dist EXIF test run for real.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const slug = process.argv[2];
if (!slug) { console.error('Usage: node scripts/gen-placeholders.mjs <slug>'); process.exit(1); }
const dir = path.resolve('clients', slug);
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'client.json'), 'utf8'));
const out = path.join(dir, 'images');
fs.mkdirSync(out, { recursive: true });
const scene = cfg.demoScene || 'roof';
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tones = ['#7d8a80', '#8c7a66', '#6f7f8c', '#8a8170', '#6d7a70', '#857565'];

function label(w, h, title, sub, light) {
  const fill = light ? '#ffffff' : '#1b2a24';
  return `<text x="50%" y="${h * 0.1}" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(w / 20)}" fill="${fill}" text-anchor="middle">${esc(title)}</text>
    <text x="50%" y="${h * 0.1 + w / 15}" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(w / 30)}" fill="${fill}" text-anchor="middle">${esc(sub)}</text>`;
}
function roof(w, h, tone, dusk, sub) {
  return `<rect width="100%" height="100%" fill="${dusk ? '#2b2f45' : '#c9d6df'}"/>
    <polygon points="${w * 0.1},${h * 0.62} ${w * 0.5},${h * 0.3} ${w * 0.9},${h * 0.62}" fill="${dusk ? '#1d2030' : '#3d4249'}"/>
    <rect x="${w * 0.18}" y="${h * 0.62}" width="${w * 0.64}" height="${h * 0.3}" fill="${dusk ? '#3a3448' : tone}"/>${label(w, h, 'DEMO PLACEHOLDER', sub, true)}`;
}
// A simple bathroom: wall, floor, a bath and a basin; evening = darker with warm light pools.
function bathroom(w, h, tone, dusk, sub, i = 0) {
  const wall = dusk ? '#3b3a36' : '#e9e4da', floor = dusk ? '#2a2620' : tone;
  const bx = w * (0.12 + (i % 3) * 0.06);
  return `<rect width="100%" height="100%" fill="${wall}"/>
    <rect y="${h * 0.68}" width="100%" height="${h * 0.32}" fill="${floor}"/>
    ${[0, 1, 2, 3, 4, 5].map((k) => `<line x1="${(w / 6) * k}" y1="${h * 0.68}" x2="${(w / 6) * k + w * 0.1}" y2="${h}" stroke="${dusk ? '#3a342b' : '#00000022'}" stroke-width="3"/>`).join('')}
    <rect x="${bx}" y="${h * 0.55}" width="${w * 0.42}" height="${h * 0.16}" fill="${dusk ? '#c9c2b4' : '#ffffff'}" stroke="#00000030"/>
    <rect x="${w * 0.66}" y="${h * 0.42}" width="${w * 0.22}" height="${h * 0.07}" fill="${dusk ? '#bdb5a5' : '#fafafa'}" stroke="#00000030"/>
    <rect x="${w * 0.7}" y="${h * 0.2}" width="${w * 0.14}" height="${h * 0.18}" fill="${dusk ? '#55524b' : '#cfd8dc'}"/>
    ${dusk ? `<circle cx="${w * 0.62}" cy="${h * 0.26}" r="${w * 0.05}" fill="#f6d79a" opacity=".85"/><circle cx="${w * 0.92}" cy="${h * 0.26}" r="${w * 0.05}" fill="#f6d79a" opacity=".85"/>` : ''}
    ${label(w, h, 'DEMO PLACEHOLDER', sub, dusk)}`;
}
// Planning: a scale drawing on a desk (the process slot must show planning, not a finished room).
function planning(w, h, sub) {
  const grid = [...Array(12).keys()].map((k) => `<line x1="${w * 0.15 + k * w * 0.06}" y1="${h * 0.25}" x2="${w * 0.15 + k * w * 0.06}" y2="${h * 0.85}" stroke="#9fb3c8" stroke-width="1"/><line x1="${w * 0.15}" y1="${h * 0.25 + k * h * 0.05}" x2="${w * 0.81}" y2="${h * 0.25 + k * h * 0.05}" stroke="#9fb3c8" stroke-width="1"/>`).join('');
  return `<rect width="100%" height="100%" fill="#6b5a48"/><rect x="${w * 0.1}" y="${h * 0.2}" width="${w * 0.8}" height="${h * 0.7}" fill="#f7f6f1"/>${grid}
    <rect x="${w * 0.2}" y="${h * 0.32}" width="${w * 0.3}" height="${h * 0.14}" fill="none" stroke="#1b2a24" stroke-width="4"/>
    <rect x="${w * 0.58}" y="${h * 0.32}" width="${w * 0.16}" height="${h * 0.1}" fill="none" stroke="#1b2a24" stroke-width="4"/>
    <line x1="${w * 0.2}" y1="${h * 0.78}" x2="${w * 0.74}" y2="${h * 0.78}" stroke="#b5562a" stroke-width="3"/>${label(w, h, 'DEMO PLACEHOLDER', sub, true)}`;
}
// Supplier stand-ins: deliberately a different composition (round mirror, tall window).
function supplier(w, h, i) {
  // Bold diagonal bands and a dark lower half: nothing like the room placeholders, so the
  // "supplier as own work" check never confuses a stand-in with the client's own photos.
  const c = ['#2f3b46', '#4a3b2f', '#33463a', '#463346'][i % 4];
  const bands = [...Array(14).keys()].map((k) => `<polygon points="${k * w / 7 - w},0 ${k * w / 7 - w + w / 14},0 ${k * w / 7 + w / 14},${h} ${k * w / 7},${h}" fill="#ffffff" opacity=".18"/>`).join('');
  return `<rect width="100%" height="100%" fill="#e8e1d4"/><rect y="${h * (0.3 + (i % 3) * 0.1)}" width="100%" height="100%" fill="${c}"/>${bands}
    <circle cx="${w * (0.25 + (i % 2) * 0.5)}" cy="${h * 0.22}" r="${w * 0.1}" fill="#f2c94c"/>
    ${label(w, h, 'DEMO SUPPLIER IMAGE', `Supplier stand-in ${i + 1}`, false)}`;
}
function portrait(w, h, sub) {
  return `<rect width="100%" height="100%" fill="#7a6f8f"/><circle cx="${w / 2}" cy="${h * 0.42}" r="${w * 0.18}" fill="#d9c9b6"/><rect x="${w * 0.25}" y="${h * 0.62}" width="${w * 0.5}" height="${h * 0.4}" fill="#3b3550"/>${label(w, h, 'DEMO PLACEHOLDER', sub, true)}`;
}

async function make(file, w, h, body) {
  const p = path.join(out, file);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)).jpeg({ quality: 88 }).toFile(p);
  return p;
}

const room = scene === 'bathroom' ? bathroom : roof;
const jobs = [];
if (cfg.hero?.image?.src) jobs.push([cfg.hero.image.src, 2400, 1600, room(2400, 1600, tones[0], false, 'Hero: best finished room', 1)]);
(cfg.projects || []).forEach((pr, i) => (pr.pairs || [{ day: pr.day, evening: pr.evening }]).forEach((x, j) => {
  const [w, h] = x.wide ? [1600, 1200] : [1200, 1600];
  if (x.day) jobs.push([x.day.src, w, h, room(w, h, tones[(i + j + 1) % tones.length], false, `${pr.title || 'Project'} · day`, i + j)]);
  if (x.evening) jobs.push([x.evening.src, w, h, room(w, h, tones[(i + j + 1) % tones.length], true, `${pr.title || 'Project'} · evening`, i + j)]);
}));
(cfg.stories || []).forEach((s, i) => { if (s.image?.src) jobs.push([s.image.src, 1600, 1200, room(1600, 1200, tones[(i + 3) % tones.length], false, `Story ${i + 1}`, i + 2)]); });
if (cfg.process?.image?.src) jobs.push([cfg.process.image.src, 1200, 1500, planning(1200, 1500, 'Process: planning drawing')]);
if (cfg.owner?.photo) jobs.push([cfg.owner.photo, 1200, 1500, portrait(1200, 1500, 'Owner portrait')]);
if (cfg.cta?.image?.src) jobs.push([cfg.cta.image.src, 1600, 1200, room(1600, 1200, '#4a4036', true, 'CTA band background', 2)]);
for (const k of ['work', 'about', 'services']) { const im = cfg.pages?.[k]?.image; if (im?.src) jobs.push([im.src, 1600, 1200, room(1600, 1200, tones[4], false, `${k} page head`, 0)]); }
(cfg.pages?.ideas?.images || []).forEach((im, i) => jobs.push([im.src, 820, 1093, supplier(820, 1093, i)]));

let tagged = false;
try { execFileSync('exiftool', ['-ver'], { stdio: 'ignore' }); tagged = true; } catch {}
const seen = new Set();
for (const [file, w, h, body] of jobs) {
  if (seen.has(file)) continue;
  seen.add(file);
  const p = await make(file, w, h, body);
  if (tagged) execFileSync('exiftool', ['-q', '-overwrite_original', '-Make=DemoCam', '-Model=DEMO X1',
    '-GPSLatitude=51.2362', '-GPSLatitudeRef=N', '-GPSLongitude=0.5704', '-GPSLongitudeRef=W', p]);
  console.log('made', path.relative(process.cwd(), p), tagged ? '(with fake GPS + camera tags)' : '');
}
