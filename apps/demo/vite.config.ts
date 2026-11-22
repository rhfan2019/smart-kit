import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

const mock = process.env.MOCK_URL ?? 'http://localhost:4400';
// PURCHASING_URL: serve /odata/purchasing/ from another service, e.g. the PostgreSQL one (http://localhost:4402,
// apps/pg-server); everything else still comes from the in-memory test service.
const purchasing = process.env.PURCHASING_URL;
const proxy = {
  ...(purchasing ? { '^/odata/purchasing/': purchasing } : {}),
  '/odata': mock,
  '/media': mock,
  '/test': mock,
};

export default defineConfig({
  plugins: [react()],
  // the PostgreSQL service answers $batch (JSON format): the purchasing service then sends several writes as one request
  define: { 'import.meta.env.VITE_PURCHASING_BATCH': JSON.stringify(purchasing ? 'json' : '') },
  // workspace packages from their sources (exports condition `smart-kit-source`, ADR-029)
  resolve: { conditions: ['smart-kit-source', ...defaultClientConditions] },
  server: { port: 4401, strictPort: true, proxy },
  preview: { port: 4401, strictPort: true, proxy },
});
