// Assembles the static web app into ./www, which Capacitor bundles into the
// native iOS/Android apps. Data still comes live from Supabase at runtime —
// this only ships the UI shell. Run via `npm run build:www` (also invoked by
// the sync scripts and by the Codemagic CI before every native build).
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

// Top-level things that make up the web app. Everything else in the repo
// (supabase/, android/, ios/, node_modules/, scripts/, git, CI config) stays out.
const INCLUDE_DIRS = ['assets'];
const INCLUDE_GLOBS = (name) => name.endsWith('.html');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Copy every top-level .html file.
for (const name of await readdir(root)) {
  if (INCLUDE_GLOBS(name)) await cp(join(root, name), join(out, name));
}
// Copy asset directories wholesale.
for (const dir of INCLUDE_DIRS) {
  if (existsSync(join(root, dir))) {
    await cp(join(root, dir), join(out, dir), { recursive: true });
  }
}

console.log('build:www → assembled www/ from', INCLUDE_DIRS.join(', '), '+ *.html');
