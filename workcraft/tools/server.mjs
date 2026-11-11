// A small static server for the staged site, with caching disabled.
// tools/stage.mjs --serve and tools/smoke.mjs both use it.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

export function serveDir(dir, port = 0) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let target = file;
    try {
      if (statSync(target).isDirectory()) target = join(target, 'index.html');
    } catch {
      res.writeHead(404).end('Not found');
      return;
    }
    let size;
    try { size = statSync(target).size; } catch {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-cache',
    });
    createReadStream(target).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      ok({ url: `http://127.0.0.1:${actual}/`, port: actual, close: () => new Promise(done => server.close(done)) });
    });
  });
}
