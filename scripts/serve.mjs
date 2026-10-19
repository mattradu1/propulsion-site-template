// Local static preview server that behaves like the static host:
// applies vercel.json headers, serves dir/index.html, and returns 404.html with a real 404.
// Usage: node scripts/serve.mjs <distDir> [port]     (binds to 127.0.0.1 only)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

export function serve(dir, port = 0) {
  dir = path.resolve(dir);
  let rules = [];
  try { rules = JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'), 'utf8')).headers || []; } catch {}
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, url);
    if (!file.startsWith(dir) || /vercel\.json|build-info\.json/.test(url)) file = '';
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(308, { Location: url + '/' }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    let status = 200;
    if (!file || !fs.existsSync(file)) { status = 404; file = path.join(dir, '404.html'); }
    for (const r of rules) {
      const re = new RegExp('^' + r.source.replace(/\(\.\*\)/g, '.*') + '$');
      if (re.test(url)) for (const h of r.headers) res.setHeader(h.key, h.value);
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.writeHead(status);
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` })));
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const { url } = await serve(process.argv[2] || 'dist/test-roofing', +(process.argv[3] || 4173));
  console.log(`Serving ${process.argv[2]} at ${url} (Ctrl+C to stop)`);
}
