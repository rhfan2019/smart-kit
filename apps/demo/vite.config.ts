import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const mock = process.env.MOCK_URL ?? 'http://localhost:4400';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4401,
    strictPort: true,
    proxy: { '/odata': mock, '/media': mock, '/test': mock },
  },
  preview: { port: 4401, strictPort: true, proxy: { '/odata': mock, '/media': mock, '/test': mock } },
});
