// Package the Maia-3 5M ONNX model at BUILD TIME; the user never runs Python.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const here = dirname(fileURLToPath(import.meta.url));
const destination = resolve(here, '../public/models/maia3_5m.onnx');
const EXPECTED_SHA = 'f7bd01b3e41dceb5e93eb9f4c61e9c4db8b35411effd1d8c984b006cd74bb804';
const DOWNLOAD_URL = 'https://huggingface.co/cemoss17/maia3-onnx/resolve/main/maia3_5m.onnx';
mkdirSync(dirname(destination), { recursive: true });
function packageDir(name) {
  let dir = here;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function findModel(dir, depth = 0) {
  if (!dir || depth > 7) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isFile() && /5[._-]?m/i.test(entry.name) && entry.name.endsWith('.onnx')) return path;
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      const nested = findModel(path, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}
async function checksum(path) {
  const h = createHash('sha256');
  for await (const data of createReadStream(path)) h.update(data);
  return h.digest('hex');
}
if (!existsSync(destination)) {
  const bundled = findModel(packageDir('maia3-js'));
  if (bundled) copyFileSync(bundled, destination);
  else {
    const tmp = destination + '.part';
    try {
      const res = await fetch(DOWNLOAD_URL, { signal: AbortSignal.timeout(180000) });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      renameSync(tmp, destination);
    } catch (err) {
      if (existsSync(tmp)) unlinkSync(tmp);
      throw err;
    }
  }
}
if (statSync(destination).size < 6_000_000 || (await checksum(destination)) !== EXPECTED_SHA) {
  throw new Error('Maia ONNX model failed size/SHA-256 verification: ' + destination);
}
console.log('[Maia-3] staged local model: ' + destination);
