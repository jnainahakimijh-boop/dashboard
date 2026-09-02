/**
 * Parse every JavaScript module in the deployment folder and resolve every
 * local import, so a syntax error or a missing module is caught before the
 * browser ever sees it.
 *
 *   npm i -D esbuild && node tools/syntax-check.mjs .
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import esbuild from 'esbuild';

const root = resolve(process.argv[2] || '.');
const SKIP = new Set(['.git', 'node_modules', 'tools']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === '.js') out.push(p);
  }
  return out;
}

const files = walk(root).sort();
let failed = 0;
for (const file of files) {
  try {
    await esbuild.transform(readFileSync(file, 'utf8'), { loader: 'js', format: 'esm', target: 'es2022', sourcefile: file });
  } catch (err) {
    failed++;
    console.error(`SYNTAX ERROR  ${file.replace(root + '/', '')}`);
    for (const e of err.errors || []) {
      console.error(`   line ${e.location?.line}: ${e.text}`);
      if (e.location?.lineText) console.error(`   > ${e.location.lineText.trim().slice(0, 160)}`);
    }
  }
}
console.log(`\nParsed ${files.length} JavaScript modules — ${failed} with syntax errors.`);

let missing = 0;
const importRe = /(?:^|[\s;{(])(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
for (const file of files) {
  for (const m of readFileSync(file, 'utf8').matchAll(importRe)) {
    const spec = m[1] || m[2] || m[3];
    if (!spec || !spec.startsWith('/')) continue;
    try { statSync(join(root, spec)); } catch {
      missing++;
      console.error(`MISSING IMPORT ${file.replace(root + '/', '')} -> ${spec}`);
    }
  }
}
console.log(`Import resolution: ${missing} unresolved local module specifiers.`);
process.exit(failed || missing ? 1 : 0);
