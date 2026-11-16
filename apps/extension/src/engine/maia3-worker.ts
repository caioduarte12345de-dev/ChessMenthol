/// <reference lib="webworker" />
/** Maia-3 runs locally in a module Web Worker inside the Brave extension. */
import * as ort from 'onnxruntime-web';
import { Maia3 } from 'maia3-js/web';

const origin = self.location.origin;
ort.env.wasm.wasmPaths = { wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm` };
ort.env.wasm.numThreads = 1;

type Key = 'purple' | 'green' | 'yellow' | 'red';
type Request = { id: number; fen: string };
type Response =
  | { id: number; kind: 'partial'; key: Key; move: string }
  | { id: number; kind: 'complete' }
  | { id: number; kind: 'error'; message: string };

let modelPromise: Promise<Maia3> | null = null;
function model(): Promise<Maia3> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const url = `${origin}/models/maia3_5m.onnx`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Maia-3 model missing: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const m = new Maia3({ variant: '5m', modelBytes: bytes, executionProviders: ['wasm'], topK: 1 });
      await m.load();
      return m;
    })().catch((err) => { modelPromise = null; throw err; });
  }
  return modelPromise;
}

// Maia-3's published training range does not validate predictions at 400 Elo.
// Red is explicitly an experimental 600-Elo policy with wider sampling.
const GREEN = [1100, 1300, 1500, 1700, 1900] as const;
function greenElo(fen: string): number {
  let hash = 2166136261;
  for (const char of fen) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return GREEN[(hash >>> 0) % GREEN.length];
}
function profiles(fen: string) {
  return [
    { key: 'purple' as const, elo: 1800, temperature: 0, topP: 1 },
    { key: 'green' as const, elo: greenElo(fen), temperature: 0.85, topP: 0.95 },
    { key: 'yellow' as const, elo: 800, temperature: 0.95, topP: 0.95 },
    { key: 'red' as const, elo: 600, temperature: 1.25, topP: 0.95 },
  ];
}
let newest: Request | null = null;
let running = false;
async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (newest) {
      const request = newest;
      newest = null;
      try {
        const m = await model();
        if (newest) continue;
        for (const p of profiles(request.fen)) {
          if (newest) break;
          const result = await m.predict({
            fen: request.fen, selfElo: p.elo, oppoElo: p.elo,
            temperature: p.temperature, topP: p.topP, topK: 1,
          });
          if (newest) break;
          self.postMessage({ id: request.id, kind: 'partial', key: p.key, move: result.bestMove } satisfies Response);
        }
        if (!newest) self.postMessage({ id: request.id, kind: 'complete' } satisfies Response);
      } catch (err) {
        if (!newest) self.postMessage({ id: request.id, kind: 'error', message: String(err) } satisfies Response);
      }
    }
  } finally {
    running = false;
  }
}
self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data;
  if (!msg || !Number.isSafeInteger(msg.id) || typeof msg.fen !== 'string') return;
  newest = msg;
  void pump();
};
