// SAP Fiori elements V4 reference app (docs/30 §7.2): serves webapp/ and proxies /odata/* and /media/* to the
// test service (apps/mock), so the FE app and the service are same-origin. SAPUI5 itself is loaded by the browser
// from https://ui5.sap.com/1.154.0/ (never stored in this repository, AL-22).
// Env: FE_PORT (default 4420), MOCK_URL (default http://localhost:4400).
import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addSiblingEntity } from './metadata.mjs';

const PORT = Number(process.env.FE_PORT ?? 4420);
const MOCK = new URL(process.env.MOCK_URL ?? 'http://localhost:4400');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'webapp');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.properties': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function proxy(req, res) {
  const metadata = /\/\$metadata(\?|$)/.test(req.url ?? '');
  const headers = { ...req.headers, host: MOCK.host };
  if (metadata) delete headers['accept-encoding'];
  const upstream = httpRequest(
    { hostname: MOCK.hostname, port: MOCK.port, method: req.method, path: req.url, headers },
    (up) => {
      const xml = metadata && /xml/.test(String(up.headers['content-type'] ?? ''));
      if (!xml) {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
        return;
      }
      const chunks = [];
      up.on('data', (c) => chunks.push(c));
      up.on('end', () => {
        const body = Buffer.from(addSiblingEntity(Buffer.concat(chunks).toString('utf8')), 'utf8');
        res.writeHead(up.statusCode ?? 502, { ...up.headers, 'content-length': String(body.length) });
        res.end(body);
      });
    },
  );
  upstream.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`[fe-reference] proxy to ${MOCK.origin} failed: ${e.message}`);
  });
  req.pipe(upstream);
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) return notFound(res);
  try {
    if (!(await stat(file)).isFile()) return notFound(res);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const server = createServer((req, res) => {
  if (/^\/(odata|media|test)\//.test(req.url ?? '')) return proxy(req, res);
  return serveStatic(req, res);
});
server.on('error', (e) => {
  console.error(`[fe-reference] ${e.code === 'EADDRINUSE' ? `port ${PORT} is in use (set FE_PORT)` : e.message}`);
  process.exit(1);
});
server.listen(PORT, () => console.log(`[fe-reference] http://localhost:${PORT}  (odata -> ${MOCK.origin})`));
