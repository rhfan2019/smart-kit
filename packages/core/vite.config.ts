import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const external = Object.keys(pkg.dependencies ?? {});

export default defineConfig({
  plugins: [dts({ tsconfigPath: './tsconfig.json', include: ['src'], rollupTypes: false })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
    rollupOptions: { external: (id) => external.some((d) => id === d || id.startsWith(`${d}/`)) },
  },
});
