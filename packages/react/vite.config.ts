import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), 'react/jsx-runtime'];

/** The root entry plus one entry per subpath in src/entries (ADR-026). */
const entries = Object.fromEntries([
  ['index', 'src/index.ts'],
  ...readdirSync('src/entries').filter((f) => f.endsWith('.ts')).map((f) => [`entries/${f.slice(0, -3)}`, `src/entries/${f}`]),
]);

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.json', include: ['src'], rollupTypes: false })],
  build: {
    lib: { entry: entries, formats: ['es'], cssFileName: 'styles' },
    sourcemap: true,
    rollupOptions: {
      external: (id) => external.some((d) => id === d || id.startsWith(`${d}/`)),
      // One output file per source file, so applications bundle only the modules they import (ADR-026 P2).
      output: { preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].js' },
    },
  },
});
