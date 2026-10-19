// sharp image pipeline: webp at display sizes, metadata stripped, size caps enforced.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export const SIZES = {
  hero: [{ w: 750, h: 938, cap: 200 }, { w: 1920, h: 1080, cap: 200 }],
  project: [{ w: 750, h: 1000, cap: 150 }, { w: 1086, h: 1448, cap: 150 }],
  owner: [{ w: 600, h: 750, cap: 150 }],
};

const POS = { centre: 'centre', center: 'centre', top: 'top', bottom: 'bottom', left: 'left', right: 'right' };

// Returns { map: { src: [{file,w,h,kb}] }, problems: [] }
export async function processImages(refs, { clientDir, outDir, quality = 72, keepMetadata = false }) {
  const map = {};
  const problems = [];
  const dir = path.join(outDir, 'assets', 'img');
  fs.mkdirSync(dir, { recursive: true });
  for (const r of refs) {
    const srcPath = path.join(clientDir, 'images', r.src);
    if (!fs.existsSync(srcPath)) continue;
    const meta = await sharp(srcPath).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) {
      problems.push({ guard: 'Images', level: 'fail', msg: `"${r.src}" is really a ${meta.format} file, not the image its name says. Quarantined, not built.` });
      continue;
    }
    const base = path.basename(r.src).replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    map[r.src] = [];
    for (const s of SIZES[r.kind]) {
      const name = `${base}-${s.w}x${s.h}.webp`;
      const file = path.join(dir, name);
      let pipe = sharp(srcPath).rotate().resize(s.w, s.h, { fit: 'cover', position: POS[r.focus] || 'attention' });
      if (keepMetadata) pipe = pipe.keepMetadata(); // test hook only: proves the EXIF guard catches leaks
      await pipe.webp({ quality, effort: 5 }).toFile(file);
      const kb = fs.statSync(file).size / 1024;
      const capName = r.kind === 'hero' ? 'hero' : 'non-hero';
      if (kb > s.cap) problems.push({ guard: 'G7 Image size', level: 'fail', msg: `${name} is ${kb.toFixed(0)} KB; the ${capName} cap is ${s.cap} KB. Crop tighter, use a cleaner photo or lower images.quality.` });
      else if (kb > s.cap * 0.9) problems.push({ guard: 'G7 Image size', level: 'amber', msg: `${name} is ${kb.toFixed(0)} KB, over 90% of its ${s.cap} KB cap.` });
      map[r.src].push({ url: `/assets/img/${name}`, w: s.w, h: s.h, kb: Math.round(kb) });
    }
  }
  return { map, problems };
}

export async function makeIcons(outDir, accent) {
  const svg = (n) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${n * 0.2}" fill="${accent}"/><path d="M${n * 0.2} ${n * 0.58} L${n * 0.5} ${n * 0.28} L${n * 0.8} ${n * 0.58} V${n * 0.78} H${n * 0.2} Z" fill="#ffffff"/></svg>`);
  await sharp(svg(32)).png().toFile(path.join(outDir, 'favicon.png'));
  await sharp(svg(180)).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
}
