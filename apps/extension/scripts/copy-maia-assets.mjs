/** Copy Maia-3 5M from the npm package into the compiled browser extension.
 *  maia3-js bundles the 5M model; this script intentionally does NOT fetch
 *  a model from the network at build time and fails visibly if it is missing. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../public/models/maia3_5m.onnx');
function packageDir(name) {
  let dir = here;
  for (;;) {
    const p = join(dir, 'node_modules', name);
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Cannot locate '+name+' in node_modules');
    dir = parent;
  }
}
function search5M(folder, depth = 0) {
  if (depth > 8) return null;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const p = join(folder, entry.name);
    if (entry.isFile() && entry.name.endsWith('.onnx') && /5[._-]?m/i.test(entry.name)) return p;
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const found = search5M(p, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
const bundled = search5M(packageDir('maia3-js'));
if (!bundled) throw new Error('maia3-js 5M ONNX asset not found; cannot create self-contained extension');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(bundled, target);
if (statSync(target).size < 6_000_000) throw new Error('Maia ONNX model is unexpectedly small');
console.log('Staged bundled Maia-3 ONNX at', target);
