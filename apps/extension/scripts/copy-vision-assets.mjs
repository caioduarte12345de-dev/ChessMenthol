// extension/scripts/copy-vision-assets.mjs
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');

// Locate an installed package's directory by walking up node_modules from here — works whether
// the dep is hoisted to the workspace root or installed locally under extension/node_modules.
function pkgDir(name) {
  let dir = here;
  for (;;) {
    const cand = join(dir, 'node_modules', name);
    if (existsSync(cand)) return cand;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`cannot locate ${name} in any node_modules — run npm install`);
    dir = parent;
  }
}

// 1. Model: reuse the desktop app's model (single source of truth).
const MODEL_SRC = join(here, '..', '..', 'desktop', 'models', 'pieces.onnx');
if (!existsSync(MODEL_SRC)) { console.error(`[copy-vision-assets] missing ${MODEL_SRC}`); process.exit(1); }
mkdirSync(join(PUB, 'models'), { recursive: true });
copyFileSync(MODEL_SRC, join(PUB, 'models', 'pieces.onnx'));

// 2. ORT runtime: exactly one wasm variant.
// ONNX Runtime 1.27 loads a matching ESM glue module (.mjs) dynamically
// before the .wasm. Both must be shipped at the same origin and version.
const ORT_ASSETS = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
mkdirSync(join(PUB, 'ort'), { recursive: true });
for (const asset of ORT_ASSETS) {
  const src = join(pkgDir('onnxruntime-web'), 'dist', asset);
  if (!existsSync(src)) { console.error(`[copy-vision-assets] missing ${src} — run npm install`); process.exit(1); }
  copyFileSync(src, join(PUB, 'ort', asset));
}
console.log(`[copy-vision-assets] staged pieces.onnx + ${ORT_ASSETS.join(', ')} into public/`);
