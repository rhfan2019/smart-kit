import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), 'react/jsx-runtime'];

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.json', include: ['src'], rollupTypes: false })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'styles' },
    sourcemap: true,
    rollupOptions: { external: (id) => external.some((d) => id === d || id.startsWith(`${d}/`)) },
  },
});
