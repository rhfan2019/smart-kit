import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

// Node tool: every dependency and Node built-in stays external; the command is dist/bin.js.
const external = [...Object.keys(pkg.dependencies ?? {}), ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  plugins: [dts({ tsconfigPath: './tsconfig.json', include: ['src'], rollupTypes: false })],
  build: {
    target: 'node24',
    ssr: true,
    lib: { entry: { index: 'src/index.ts', bin: 'src/bin.ts' }, formats: ['es'], fileName: (_f, name) => `${name}.js` },
    sourcemap: true,
    rollupOptions: { external: (id) => external.some((d) => id === d || id.startsWith(`${d}/`)) },
  },
});
