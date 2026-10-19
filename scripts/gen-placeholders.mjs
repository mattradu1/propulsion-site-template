// Generates DEMO placeholder photos locally with sharp (no stock downloads).
// Usage: node scripts/gen-placeholders.mjs <slug>
// Each source JPEG gets fake camera + GPS tags (via exiftool when installed) so the
// build's metadata-stripping and the dist EXIF test are exercised for real.
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

const palette = ['#6b7f8e', '#8c6d5a', '#5f7461', '#7a6f8f', '#8a8160', '#5d6f86'];
const svgEsc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function make(file, label, w, h, colour, dusk) {
  const bg = dusk ? '#2b2f45' : colour;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dusk ? '#4a3f63' : '#c9d6df'}"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <polygon points="${w * 0.1},${h * 0.62} ${w * 0.5},${h * 0.3} ${w * 0.9},${h * 0.62}" fill="${dusk ? '#1d2030' : '#3d4249'}" opacity="0.85"/>
    <rect x="${w * 0.18}" y="${h * 0.62}" width="${w * 0.64}" height="${h * 0.3}" fill="${dusk ? '#3a3448' : '#d8cfc0'}"/>
    <text x="50%" y="${h * 0.16}" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(w / 18)}" fill="#ffffff" text-anchor="middle">DEMO PLACEHOLDER</text>
    <text x="50%" y="${h * 0.23}" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(w / 26)}" fill="#ffffff" text-anchor="middle">${svgEsc(label)}</text>
  </svg>`;
  const p = path.join(out, file);
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(p);
  return p;
}

const jobs = [];
if (cfg.hero?.image?.src) jobs.push([cfg.hero.image.src, 'Hero', 2400, 1600, palette[0], false]);
(cfg.projects || []).forEach((pr, i) => {
  if (pr.day) jobs.push([pr.day.src, `${pr.title} · day`, 1600, 2133, palette[(i + 1) % palette.length], false]);
  if (pr.evening) jobs.push([pr.evening.src, `${pr.title} · evening`, 1600, 2133, palette[(i + 1) % palette.length], true]);
});
if (cfg.owner?.photo) jobs.push([cfg.owner.photo, 'Owner portrait', 1200, 1500, palette[3], false]);

let tagged = false;
try { execFileSync('exiftool', ['-ver'], { stdio: 'ignore' }); tagged = true; } catch {}
for (const j of jobs) {
  const p = await make(...j);
  if (tagged) execFileSync('exiftool', ['-q', '-overwrite_original', '-Make=DemoCam', '-Model=DEMO X1',
    '-GPSLatitude=51.6286', '-GPSLatitudeRef=N', '-GPSLongitude=0.7482', '-GPSLongitudeRef=W', p]);
  console.log('made', path.relative(process.cwd(), p), tagged ? '(with fake GPS + camera tags)' : '');
}
