/**
 * Copies the SQLite wasm build into public/assets, where jeep-sqlite looks for
 * it at runtime (its default wasmPath is "/assets").
 *
 * Without this the browser build of the SQLite plugin silently falls back to
 * fetching the app's index.html and fails to compile it as wasm, so the whole
 * data layer never starts. Copied rather than committed so it always matches
 * the installed sql.js version.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const source = require.resolve('sql.js/dist/sql-wasm.wasm');
const targetDir = resolve(here, '../public/assets');
const target = resolve(targetDir, 'sql-wasm.wasm');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
