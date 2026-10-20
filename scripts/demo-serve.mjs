// v4 sales demo: builds every client in demo-reel.json with --demo-mode and serves each on its own local port
// (127.0.0.1 only), so Matt can screen-share one demo and switch trades from the ribbon. Never deployed.
// Usage: node scripts/demo-serve.mjs        → http://localhost:4201/ (roofing), :4202 (bathrooms), :4203 (gutters)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, printReport, loadDemoReel } from '../build.mjs';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reel = loadDemoReel(ROOT);
if (!reel.length) { console.error('demo-reel.json lists no clients.'); process.exit(2); }
for (const c of reel) {
  const res = await build({ slug: c.slug, demoMode: true, root: ROOT });
  printReport(res, { quiet: true });
  if (!res.ok) process.exit(1); // a non-DEMO client in the reel fails here, by design
  const port = Number(new URL(c.url).port);
  await serve(res.outDir, port);
  console.log(`${c.trade.padEnd(12)} ${c.url}`);
}
console.log('\nDemo sites running. Every page carries the "DEMO — example site" ribbon. Ctrl+C to stop.');
