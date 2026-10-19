// Bundles the API server into dist-server/ (dependencies stay external).
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist-server/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.server.json',
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});

mkdirSync('dist-server/migrations', { recursive: true });
cpSync('server/db/migrations', 'dist-server/migrations', { recursive: true });
console.log('Server bundle written to dist-server/');
