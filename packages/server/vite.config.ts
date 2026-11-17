import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

// Node library: every dependency and Node built-in stays external.
const external = [...Object.keys(pkg.dependencies ?? {}), ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  plugins: [dts({ tsconfigPath: './tsconfig.json', include: ['src'], rollupTypes: false })],
  build: {
    target: 'node24',
    ssr: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
    rollupOptions: { external: (id) => external.some((d) => id === d || id.startsWith(`${d}/`)) },
  },
});
