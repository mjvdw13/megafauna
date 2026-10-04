// Zero-dependency static file server for local development.
// Usage: npm start  (or: node scripts/serve.mjs [port])
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(root, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
        if (statSync(file).isDirectory()) file = join(file, 'index.html');
        statSync(file);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
}).listen(port, () => console.log(`MegaFauna running at http://localhost:${port}`));
