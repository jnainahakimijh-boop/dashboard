/**
 * Run the dataset invariants in Node by resolving the application's absolute
 * "/src/..." specifiers against the deployment folder.
 *
 *   npm i -D esbuild && node tools/data-check.mjs .
 */
import { resolve } from 'node:path';
import esbuild from 'esbuild';

const root = resolve(process.argv[2] || '.');

const build = await esbuild.build({
  entryPoints: [`${root}/src/lib/dataIntegrity.js`],
  bundle: true, format: 'esm', write: false, platform: 'neutral', target: ['es2022'],
  plugins: [{
    name: 'app-root',
    setup(b) { b.onResolve({ filter: /^\/src\// }, (args) => ({ path: `${root}${args.path}` })); },
  }],
});

const code = build.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const checks = mod.runDataIntegrityChecks();

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(52)} ${c.detail ?? ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} dataset invariants hold.`);
process.exit(failed ? 1 : 0);
