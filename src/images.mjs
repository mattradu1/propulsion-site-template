// sharp image pipeline: webp at slot sizes (Brand, Art Direction & Build Standard, 17 Oct),
// metadata stripped, size caps enforced, never upscaled past the source.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// Slot → crops, smallest first. cap in KB. h: null keeps the source ratio.
export const SIZES = {
  hero: [{ w: 750, h: 938, cap: 200 }, { w: 1920, h: 1080, cap: 200 }],      // 4:5 phone, 16:9 desktop (variant A, full-bleed)
  heroSplit: [{ w: 750, h: 938, cap: 200 }, { w: 1200, h: 1000, cap: 200 }], // variant B, half-width panel
  heroInset: [{ w: 750, h: 938, cap: 200 }, { w: 900, h: 1125, cap: 200 }],  // variant C, framed 4:5 inset
  project: [{ w: 750, h: 1000, cap: 150 }, { w: 1086, h: 1448, cap: 150 }],  // 3:4 day/evening pairs
  projectWide: [{ w: 750, h: 563, cap: 150 }, { w: 1200, h: 900, cap: 150 }], // 4:3 wide pair (one per project)
  compare: [{ w: 750, h: 563, cap: 120 }, { w: 1086, h: 815, cap: 150 }],  // v3 before/after, 4:3, both photos the same crop
  section: [{ w: 750, h: 938, cap: 120 }, { w: 1200, h: 900, cap: 120 }],    // 4:5 phone, 4:3 desktop
  portrait: [{ w: 600, h: 750, cap: 120 }, { w: 900, h: 1125, cap: 120 }],   // owner, process (4:5)
  thumb: [{ w: 600, h: null, cap: 60 }],                                       // Ideas page supplier images
  logo: [{ w: null, h: 72, cap: 20 }],                                         // shown at 36px tall
};

const POS = { centre: 'centre', center: 'centre', top: 'top', bottom: 'bottom', left: 'left', right: 'right' };

export async function processImages(refs, { clientDir, outDir, quality = 72, keepMetadata = false }) {
  const map = {};
  const problems = [];
  const dir = path.join(outDir, 'assets', 'img');
  fs.mkdirSync(dir, { recursive: true });
  const done = new Set();
  for (const r of refs) {
    const key = `${r.src}|${r.kind}`;
    if (done.has(key)) continue;
    done.add(key);
    const srcPath = path.join(clientDir, 'images', r.src);
    if (!fs.existsSync(srcPath)) continue;
    const meta = await sharp(srcPath).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) {
      problems.push({ guard: 'Images', level: 'fail', msg: `"${r.src}" is really a ${meta.format} file, not the image its name says. Quarantined, not built.` });
      continue;
    }
    const base = path.basename(r.src).replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const list = [];
    for (const s of SIZES[r.kind]) {
      // Never upscale: shrink the target box to fit inside the source, keeping the slot's ratio.
      let w = s.w, hgt = s.h;
      if (w && hgt) { const k = Math.min(1, meta.width / w, meta.height / hgt); w = Math.round(w * k); hgt = Math.round(hgt * k); }
      else if (w) { w = Math.min(w, meta.width); hgt = Math.round(meta.height * (w / meta.width)); }
      else { hgt = Math.min(hgt, meta.height); w = Math.round(meta.width * (hgt / meta.height)); }
      if (list.some((x) => x.w === w && x.h === hgt)) continue;
      const name = `${base}-${r.kind}-${w}x${hgt}.webp`;
      const file = path.join(dir, name);
      let pipe = sharp(srcPath).rotate().resize(w, hgt, { fit: 'cover', position: POS[r.focus] || 'attention' });
      if (keepMetadata) pipe = pipe.keepMetadata(); // test hook only: proves the EXIF guard catches leaks
      await pipe.webp({ quality: r.kind === 'logo' ? 90 : quality, effort: 5, alphaQuality: 90 }).toFile(file);
      const kb = fs.statSync(file).size / 1024;
      if (kb > s.cap) problems.push({ guard: 'G7 Image size', level: 'fail', msg: `${name} is ${kb.toFixed(0)} KB; the ${r.kind} cap is ${s.cap} KB. Crop tighter, use a cleaner photo or lower images.quality.` });
      else if (kb > s.cap * 0.9) problems.push({ guard: 'G7 Image size', level: 'amber', msg: `${name} is ${kb.toFixed(0)} KB, over 90% of its ${s.cap} KB cap.` });
      if (s.w && s.h && (w < s.w * 0.6)) problems.push({ guard: 'Images', level: 'amber', msg: `${r.src} (${r.where}) is only ${meta.width}×${meta.height}; the ${r.kind} slot wants ${s.w}×${s.h}. Ask for a larger original.` });
      list.push({ url: `/assets/img/${name}`, w, h: hgt, kb: Math.round(kb) });
    }
    map[`${r.src}|${r.kind}`] = list;
  }
  return { map, problems };
}

// Difference hash (16×16 = 256 bits). Used to catch a supplier image passed off as the client's own work.
// Each file is decoded once to a small greyscale raster; the crop grid is cut from that raster.
const cache = new Map();
async function hashes(file) {
  if (cache.has(file)) return cache.get(file);
  const W = 340, H = 320; // working raster
  const g = await sharp(file).greyscale().resize(W, H, { fit: 'fill' }).raw().toBuffer();
  const dh = (x0, y0, w, h) => {
    const bits = new Uint8Array(256);
    const at = (x, y) => g[Math.min(H - 1, Math.floor(y0 + (y + 0.5) * h / 16)) * W + Math.min(W - 1, Math.floor(x0 + (x + 0.5) * w / 17))];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits[y * 16 + x] = at(x, y) > at(x + 1, y) ? 1 : 0;
    return bits;
  };
  const out = { full: dh(0, 0, W, H), crops: [] };
  for (const s of [0.9, 0.8, 0.7, 0.6]) for (const [fx, fy] of [[0.5, 0.5], [0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1]]) {
    const w = W * s, h = H * s;
    out.crops.push(dh((W - w) * fx, (H - h) * fy, w, h));
  }
  cache.set(file, out);
  return out;
}
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] !== b[i]; return d; };
// Smallest distance between a and b, trying crops of each against the other.
export async function nearDuplicate(a, b) {
  const A = await hashes(a), B = await hashes(b);
  let min = ham(A.full, B.full);
  for (const c of B.crops) min = Math.min(min, ham(A.full, c));
  for (const c of A.crops) min = Math.min(min, ham(B.full, c));
  return min;
}
export const NEAR_DUP = 24; // of 256 bits. Darren's supplier crops score 13–18; unrelated rooms 56+.

export async function makeIcons(outDir, dark, accent) {
  const svg = (n) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><rect width="${n}" height="${n}" fill="${dark}"/><rect x="${n * 0.3}" y="${n * 0.3}" width="${n * 0.4}" height="${n * 0.4}" transform="rotate(45 ${n / 2} ${n / 2})" fill="${accent}"/></svg>`);
  await sharp(svg(32)).png().toFile(path.join(outDir, 'favicon.png'));
  await sharp(svg(180)).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
}
