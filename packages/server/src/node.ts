// Adapter for node:http (and Express, which passes the same objects): IncomingMessage -> Request, Response -> ServerResponse.
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Wraps a Web-standard handler as a node:http request listener. */
export function toNodeListener(handle: (request: Request) => Promise<Response>, origin = 'http://localhost') {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', `${origin.replace(/\/$/, '')}`);
      if (req.headers.host) url.host = req.headers.host;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const body = hasBody ? await new Promise<Buffer>((resolve, reject) => {
        const parts: Buffer[] = [];
        req.on('data', (c: Buffer) => parts.push(c));
        req.on('end', () => resolve(Buffer.concat(parts)));
        req.on('error', reject);
      }) : undefined;
      const response = await handle(new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined }));
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      const buf = Buffer.from(await response.arrayBuffer());
      if (!res.hasHeader('content-length')) res.setHeader('Content-Length', buf.length);
      res.end(req.method === 'HEAD' ? undefined : buf);
    } catch (e) {
      res.statusCode = 500;
      res.end(String((e as Error)?.message ?? e));
    }
  };
}
